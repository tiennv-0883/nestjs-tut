import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FavoritesService } from './favorites.service';
import { Favorite } from './favorite.entity';
import { Article } from '../article.entity';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockFavoriteRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockArticleRepo = {
    findOne: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn().mockReturnValue('translated'),
  };

  const makeArticle = (overrides: Partial<Article> = {}): Article =>
    ({
      id: 1,
      title: 'Test Article',
      slug: 'test-article',
      author: { id: 1, email: 'author@test.com', name: 'Author' },
      ...overrides,
    }) as Article;

  const makeFavorite = (overrides: Partial<Favorite> = {}): Favorite =>
    ({
      id: 1,
      userId: 2,
      articleId: 1,
      createdAt: new Date(),
      ...overrides,
    }) as Favorite;

  const makeFavoriteWithRelations = (
    overrides: Partial<Favorite> = {},
  ): Favorite =>
    makeFavorite({
      article: makeArticle() as never,
      ...overrides,
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockI18nService.t.mockReturnValue('translated');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: mockFavoriteRepo },
        { provide: getRepositoryToken(Article), useValue: mockArticleRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findMyFavorites ───────────────────────────────────────────────────────

  describe('findMyFavorites', () => {
    it('returns serialized favorites for the user', async () => {
      const favorites = [makeFavoriteWithRelations()];
      mockFavoriteRepo.find.mockResolvedValueOnce(favorites);

      const result = await service.findMyFavorites(2);

      expect(mockFavoriteRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 2 } }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 1, userId: 2, articleId: 1 }),
      ]);
    });

    it('returns empty array when user has no favorites', async () => {
      mockFavoriteRepo.find.mockResolvedValueOnce([]);

      const result = await service.findMyFavorites(2);

      expect(result).toEqual([]);
    });
  });

  // ── favorite ──────────────────────────────────────────────────────────────

  describe('favorite', () => {
    it('creates and returns a serialized favorite', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      mockFavoriteRepo.findOne.mockResolvedValueOnce(null);
      const favorite = makeFavorite();
      mockFavoriteRepo.create.mockReturnValueOnce(favorite);
      mockFavoriteRepo.save.mockResolvedValueOnce(favorite);

      const result = await service.favorite(1, 2);

      expect(mockArticleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
      });
      expect(mockFavoriteRepo.create).toHaveBeenCalledWith({
        userId: 2,
        articleId: 1,
      });
      expect(mockFavoriteRepo.save).toHaveBeenCalledWith(favorite);
      expect(result).toEqual(
        expect.objectContaining({ id: 1, userId: 2, articleId: 1 }),
      );
    });

    it('throws NotFoundException when article does not exist', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.favorite(99, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockFavoriteRepo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already favorited', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      mockFavoriteRepo.findOne.mockResolvedValueOnce(makeFavorite());

      await expect(service.favorite(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockFavoriteRepo.create).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when save fails', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      mockFavoriteRepo.findOne.mockResolvedValueOnce(null);
      mockFavoriteRepo.create.mockReturnValueOnce(makeFavorite());
      mockFavoriteRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.favorite(1, 2)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  // ── unfavorite ────────────────────────────────────────────────────────────

  describe('unfavorite', () => {
    it('removes the favorite', async () => {
      const favorite = makeFavorite();
      mockFavoriteRepo.findOne.mockResolvedValueOnce(favorite);
      mockFavoriteRepo.remove.mockResolvedValueOnce(undefined);

      await service.unfavorite(1, 2);

      expect(mockFavoriteRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 2, articleId: 1 },
      });
      expect(mockFavoriteRepo.remove).toHaveBeenCalledWith(favorite);
    });

    it('throws NotFoundException when favorite does not exist', async () => {
      mockFavoriteRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.unfavorite(99, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockFavoriteRepo.remove).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when remove fails', async () => {
      mockFavoriteRepo.findOne.mockResolvedValueOnce(makeFavorite());
      mockFavoriteRepo.remove.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.unfavorite(1, 2)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
