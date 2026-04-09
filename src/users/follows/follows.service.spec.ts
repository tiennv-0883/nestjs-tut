import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FollowsService } from './follows.service';
import { Follow } from './follow.entity';
import { User } from '../user.entity';

describe('FollowsService', () => {
  let service: FollowsService;

  const mockFollowRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn().mockReturnValue('translated'),
  };

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 10,
      email: 'target@test.com',
      name: 'Target',
      ...overrides,
    }) as User;

  const makeFollow = (overrides: Partial<Follow> = {}): Follow =>
    ({
      id: 1,
      followerId: 2,
      followingId: 10,
      createdAt: new Date(),
      ...overrides,
    }) as Follow;

  const makeFollowWithRelations = (overrides: Partial<Follow> = {}): Follow =>
    makeFollow({
      following: makeUser() as never,
      ...overrides,
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockI18nService.t.mockReturnValue('translated');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: getRepositoryToken(Follow), useValue: mockFollowRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findMyFollowings ──────────────────────────────────────────────────────

  describe('findMyFollowings', () => {
    it('returns serialized followings for the user', async () => {
      const follows = [makeFollowWithRelations()];
      mockFollowRepo.find.mockResolvedValueOnce(follows);

      const result = await service.findMyFollowings(2);

      expect(mockFollowRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { followerId: 2 } }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 1, followerId: 2, followingId: 10 }),
      ]);
    });

    it('returns empty array when user follows nobody', async () => {
      mockFollowRepo.find.mockResolvedValueOnce([]);

      const result = await service.findMyFollowings(2);

      expect(result).toEqual([]);
    });
  });

  // ── follow ────────────────────────────────────────────────────────────────

  describe('follow', () => {
    it('creates and returns a serialized follow', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(makeUser());
      mockFollowRepo.findOne
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce(makeFollowWithRelations()); // refetch with relations
      const follow = makeFollow();
      mockFollowRepo.create.mockReturnValueOnce(follow);
      mockFollowRepo.save.mockResolvedValueOnce(follow);

      const result = await service.follow(10, 2);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { id: 10 } });
      expect(mockFollowRepo.create).toHaveBeenCalledWith({
        followerId: 2,
        followingId: 10,
      });
      expect(mockFollowRepo.save).toHaveBeenCalledWith(follow);
      expect(result).toEqual(
        expect.objectContaining({ id: 1, followerId: 2, followingId: 10 }),
      );
    });

    it('throws BadRequestException when trying to follow self', async () => {
      await expect(service.follow(5, 5)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockUserRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when target user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.follow(99, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockFollowRepo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already following', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(makeUser());
      mockFollowRepo.findOne.mockResolvedValueOnce(makeFollow());

      await expect(service.follow(10, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockFollowRepo.create).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when save fails', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(makeUser());
      mockFollowRepo.findOne.mockResolvedValueOnce(null);
      mockFollowRepo.create.mockReturnValueOnce(makeFollow());
      mockFollowRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.follow(10, 2)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // ── unfollow ──────────────────────────────────────────────────────────────

  describe('unfollow', () => {
    it('removes the follow', async () => {
      const follow = makeFollow();
      mockFollowRepo.findOne.mockResolvedValueOnce(follow);
      mockFollowRepo.remove.mockResolvedValueOnce(undefined);

      await service.unfollow(10, 2);

      expect(mockFollowRepo.findOne).toHaveBeenCalledWith({
        where: { followerId: 2, followingId: 10 },
      });
      expect(mockFollowRepo.remove).toHaveBeenCalledWith(follow);
    });

    it('throws NotFoundException when not following the user', async () => {
      mockFollowRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.unfollow(99, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockFollowRepo.remove).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when remove fails', async () => {
      mockFollowRepo.findOne.mockResolvedValueOnce(makeFollow());
      mockFollowRepo.remove.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.unfollow(10, 2)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
