import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

describe('FollowsController', () => {
  let controller: FollowsController;

  const mockFollowsService = {
    findMyFollowings: jest.fn(),
    follow: jest.fn(),
    unfollow: jest.fn(),
  };

  const mockReq = (sub: number) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  const makeFollow = (overrides = {}) => ({
    id: 1,
    followerId: 2,
    followingId: 10,
    createdAt: new Date(),
    following: { id: 10, email: 'target@test.com', name: 'Target' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [{ provide: FollowsService, useValue: mockFollowsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FollowsController>(FollowsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /users/followings ─────────────────────────────────────────────────

  describe('findMyFollowings', () => {
    it('returns followings for the current user', async () => {
      const follows = [makeFollow()];
      mockFollowsService.findMyFollowings.mockResolvedValueOnce(follows);

      const result = await controller.findMyFollowings(mockReq(2));

      expect(mockFollowsService.findMyFollowings).toHaveBeenCalledWith(2);
      expect(result).toEqual(follows);
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FollowsController.prototype,
        'findMyFollowings',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── POST /users/:userId/follow ────────────────────────────────────────────

  describe('follow', () => {
    it('delegates to service with userId and followerId from JWT', async () => {
      const follow = makeFollow();
      mockFollowsService.follow.mockResolvedValueOnce(follow);

      const result = await controller.follow(10, mockReq(2));

      expect(mockFollowsService.follow).toHaveBeenCalledWith(10, 2);
      expect(result).toEqual(follow);
    });

    it('propagates BadRequestException when following self', async () => {
      mockFollowsService.follow.mockRejectedValueOnce(
        new BadRequestException(),
      );

      await expect(controller.follow(2, mockReq(2))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when target user does not exist', async () => {
      mockFollowsService.follow.mockRejectedValueOnce(new NotFoundException());

      await expect(controller.follow(99, mockReq(2))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates ConflictException when already following', async () => {
      mockFollowsService.follow.mockRejectedValueOnce(new ConflictException());

      await expect(controller.follow(10, mockReq(2))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FollowsController.prototype,
        'follow',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── DELETE /users/:userId/follow ──────────────────────────────────────────

  describe('unfollow', () => {
    it('delegates to service with userId and followerId from JWT', async () => {
      mockFollowsService.unfollow.mockResolvedValueOnce(undefined);

      await controller.unfollow(10, mockReq(2));

      expect(mockFollowsService.unfollow).toHaveBeenCalledWith(10, 2);
    });

    it('propagates NotFoundException when not following the user', async () => {
      mockFollowsService.unfollow.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(controller.unfollow(99, mockReq(2))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FollowsController.prototype,
        'unfollow',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
