import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticlesService } from './articles.service';
import { Article } from './article.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;

  const mockArticleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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
    it('returns all articles ordered by createdAt desc', async () => {
      const articles = [makeArticle()];
      mockArticleRepo.find.mockResolvedValueOnce(articles);

      const result = await service.findAll();

      expect(mockArticleRepo.find).toHaveBeenCalledWith({
        relations: ['author'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(articles);
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
      // first findOne (slug 'my-article') → exists with different id
      mockArticleRepo.findOne
        .mockResolvedValueOnce(makeArticle({ id: 99 })) // 'my-article' taken
        .mockResolvedValueOnce(null); // 'my-article-1' free
      const saved = makeArticle({ slug: 'my-article-1' });
      mockArticleRepo.create.mockReturnValueOnce(saved);
      mockArticleRepo.save.mockResolvedValueOnce(saved);

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
});
