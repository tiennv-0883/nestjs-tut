import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticlesService } from './articles.service';
import { Article } from './article.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let mockQb: Record<string, jest.Mock>;

  const mockArticleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn().mockReturnValue('translated'),
  };

  const makeArticle = (overrides: Partial<Article> = {}): Article =>
    ({
      id: 1,
      slug: 'my-article',
      title: 'My Article',
      description: null,
      body: 'body content',
      tags: null,
      status: 'published',
      authorId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Article;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    mockArticleRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockI18nService.t.mockReturnValue('translated');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: mockArticleRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated articles with default page and limit', async () => {
      const articles = [makeArticle()];
      mockQb.getManyAndCount.mockResolvedValueOnce([articles, 1]);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: articles,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('applies search filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.findAll({ search: 'nestjs' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE :search'),
        expect.objectContaining({ search: '%nestjs%' }),
      );
    });

    it('applies authorId filter when provided', async () => {
      mockQb.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.findAll({ authorId: 2 });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'article.authorId = :authorId',
        { authorId: 2 },
      );
    });

    it('calculates correct totalPages', async () => {
      mockQb.getManyAndCount.mockResolvedValueOnce([[], 25]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns the article when found', async () => {
      const article = makeArticle();
      mockArticleRepo.findOne.mockResolvedValueOnce(article);

      const result = await service.findBySlug('my-article');

      expect(result).toEqual(article);
    });

    it('throws NotFoundException when not found', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlug('unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates article with generated slug and saves it', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(null); // slug is unique
      const saved = makeArticle({ authorId: 2 });
      mockArticleRepo.create.mockReturnValueOnce(saved);
      mockArticleRepo.save.mockResolvedValueOnce(saved);
      mockArticleRepo.findOne.mockResolvedValueOnce(saved);

      const result = await service.create(
        { title: 'My Article', body: 'body' },
        2,
      );

      expect(mockArticleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'my-article',
          authorId: 2,
        }),
      );
      expect(result).toEqual(saved);
    });

    it('appends a counter when slug already exists', async () => {
      mockArticleRepo.findOne
        .mockResolvedValueOnce(makeArticle({ id: 99 })) // 'my-article' taken
        .mockResolvedValueOnce(null); // 'my-article-1' free
      const saved = makeArticle({ slug: 'my-article-1' });
      mockArticleRepo.create.mockReturnValueOnce(saved);
      mockArticleRepo.save.mockResolvedValueOnce(saved);
      mockArticleRepo.findOne.mockResolvedValueOnce(saved);

      await service.create({ title: 'My Article', body: 'body' }, 1);

      expect(mockArticleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'my-article-1' }),
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates article fields and saves', async () => {
      const article = makeArticle();
      mockArticleRepo.findOne.mockResolvedValueOnce(article); // findById
      const updated = { ...article, body: 'new body' };
      mockArticleRepo.save.mockResolvedValueOnce(updated);

      const result = await service.update(1, { body: 'new body' }, 1);

      expect(mockArticleRepo.save).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException when requester is not the author', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(
        makeArticle({ authorId: 5 }),
      );

      await expect(service.update(1, { body: 'x' }, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('re-slugifies when title changes', async () => {
      const article = makeArticle({ id: 1, title: 'My Article' });
      mockArticleRepo.findOne
        .mockResolvedValueOnce(article) // findById
        .mockResolvedValueOnce(null); // unique slug check for new title
      mockArticleRepo.save.mockResolvedValueOnce({
        ...article,
        title: 'New Title',
        slug: 'new-title',
      });

      await service.update(1, { title: 'New Title' }, 1);

      expect(mockArticleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'new-title' }),
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the article when requester is the author', async () => {
      const article = makeArticle();
      mockArticleRepo.findOne.mockResolvedValueOnce(article);
      mockArticleRepo.remove.mockResolvedValueOnce(undefined);

      await service.remove(1, 1);

      expect(mockArticleRepo.remove).toHaveBeenCalledWith(article);
    });

    it('throws ForbiddenException when requester is not the author', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(
        makeArticle({ authorId: 5 }),
      );

      await expect(service.remove(1, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── publish ───────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('sets status to published and saves', async () => {
      const article = makeArticle({ status: 'draft' });
      mockArticleRepo.findOne.mockResolvedValueOnce(article);
      const saved = { ...article, status: 'published' };
      mockArticleRepo.save.mockResolvedValueOnce(saved);

      const result = await service.publish('my-article', 1);

      expect(mockArticleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
      );
      expect(result).toEqual(saved);
    });

    it('throws ForbiddenException when requester is not the author', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(
        makeArticle({ authorId: 5 }),
      );

      await expect(service.publish('my-article', 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── unpublish ─────────────────────────────────────────────────────────────

  describe('unpublish', () => {
    it('sets status to draft and saves', async () => {
      const article = makeArticle({ status: 'published' });
      mockArticleRepo.findOne.mockResolvedValueOnce(article);
      const saved = { ...article, status: 'draft' };
      mockArticleRepo.save.mockResolvedValueOnce(saved);

      const result = await service.unpublish('my-article', 1);

      expect(mockArticleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
      );
      expect(result).toEqual(saved);
    });

    it('throws ForbiddenException when requester is not the author', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(
        makeArticle({ authorId: 5 }),
      );

      await expect(service.unpublish('my-article', 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
