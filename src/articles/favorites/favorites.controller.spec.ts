import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

describe('FavoritesController', () => {
  let controller: FavoritesController;

  const mockFavoritesService = {
    findMyFavorites: jest.fn(),
    favorite: jest.fn(),
    unfavorite: jest.fn(),
  };

  const mockReq = (sub: number) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  const makeFavorite = (overrides = {}) => ({
    id: 1,
    userId: 2,
    articleId: 1,
    createdAt: new Date(),
    article: { id: 1, title: 'Test', slug: 'test' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FavoritesController>(FavoritesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /articles/favorites ───────────────────────────────────────────────

  describe('findMine', () => {
    it('returns favorites for the current user', async () => {
      const favorites = [makeFavorite()];
      mockFavoritesService.findMyFavorites.mockResolvedValueOnce(favorites);

      const result = await controller.findMine(mockReq(2));

      expect(mockFavoritesService.findMyFavorites).toHaveBeenCalledWith(2);
      expect(result).toEqual(favorites);
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FavoritesController.prototype,
        'findMine',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── POST /articles/:articleId/favorite ────────────────────────────────────

  describe('favorite', () => {
    it('delegates to service with articleId and userId from JWT', async () => {
      const favorite = makeFavorite();
      mockFavoritesService.favorite.mockResolvedValueOnce(favorite);

      const result = await controller.favorite(1, mockReq(2));

      expect(mockFavoritesService.favorite).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(favorite);
    });

    it('propagates NotFoundException when article does not exist', async () => {
      mockFavoritesService.favorite.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(controller.favorite(99, mockReq(2))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates ConflictException when already favorited', async () => {
      mockFavoritesService.favorite.mockRejectedValueOnce(
        new ConflictException(),
      );

      await expect(controller.favorite(1, mockReq(2))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FavoritesController.prototype,
        'favorite',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── DELETE /articles/:articleId/favorite ──────────────────────────────────

  describe('unfavorite', () => {
    it('delegates to service with articleId and userId from JWT', async () => {
      mockFavoritesService.unfavorite.mockResolvedValueOnce(undefined);

      await controller.unfavorite(1, mockReq(2));

      expect(mockFavoritesService.unfavorite).toHaveBeenCalledWith(1, 2);
    });

    it('propagates NotFoundException when favorite does not exist', async () => {
      mockFavoritesService.unfavorite.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(
        controller.unfavorite(99, mockReq(2)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        FavoritesController.prototype,
        'unfavorite',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
