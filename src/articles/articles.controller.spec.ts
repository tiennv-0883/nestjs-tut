import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ArticleSerializer } from './article.serializer';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('ArticlesController', () => {
  let controller: ArticlesController;

  const mockArticlesService = {
    findAll: jest.fn(),
    findByAuthor: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
  };

  const mockReq = (sub: number) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  const makeArticle = (overrides = {}) => ({
    id: 1,
    slug: 'hello',
    title: 'Hello',
    description: null,
    body: 'body',
    tags: null,
    status: 'draft',
    authorId: 1,
    author: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Bypass serialization — controller delegation is what we're testing here
    jest
      .spyOn(ArticleSerializer, 'serializePaginated')
      .mockImplementation(
        (r) => r as ReturnType<typeof ArticleSerializer.serializePaginated>,
      );
    jest.spyOn(ArticleSerializer, 'serializeMany').mockImplementation((a) => a);
    jest.spyOn(ArticleSerializer, 'serializeOne').mockImplementation((a) => a);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [{ provide: ArticlesService, useValue: mockArticlesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ArticlesController>(ArticlesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /articles ─────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns serialized paginated articles', async () => {
      const paginated = {
        data: [makeArticle()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      mockArticlesService.findAll.mockResolvedValueOnce(paginated);

      const result = await controller.findAll({});

      expect(mockArticlesService.findAll).toHaveBeenCalledWith({});
      expect(ArticleSerializer.serializePaginated).toHaveBeenCalled();
      expect(result).toEqual(paginated);
    });
  });

  // ── GET /articles/me ──────────────────────────────────────────────────────

  describe('findMine', () => {
    it('returns serialized articles for the current user', async () => {
      const articles = [makeArticle()];
      mockArticlesService.findByAuthor.mockResolvedValueOnce(articles);

      const result = await controller.findMine(mockReq(3));

      expect(mockArticlesService.findByAuthor).toHaveBeenCalledWith(3);
      expect(ArticleSerializer.serializeMany).toHaveBeenCalled();
      expect(result).toEqual(articles);
    });
  });

  // ── GET /articles/:slug ───────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns serialized article by slug', async () => {
      const article = makeArticle();
      mockArticlesService.findBySlug.mockResolvedValueOnce(article);

      const result = await controller.findOne('hello');

      expect(mockArticlesService.findBySlug).toHaveBeenCalledWith('hello');
      expect(ArticleSerializer.serializeOne).toHaveBeenCalled();
      expect(result).toEqual(article);
    });

    it('propagates NotFoundException when not found', async () => {
      mockArticlesService.findBySlug.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── POST /articles ────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to service with authorId from JWT and serializes result', async () => {
      const dto = { title: 'Hello', body: 'World' };
      const created = makeArticle({ ...dto });
      mockArticlesService.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto as never, mockReq(7));

      expect(mockArticlesService.create).toHaveBeenCalledWith(dto, 7);
      expect(ArticleSerializer.serializeOne).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        ArticlesController.prototype,
        'create',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── PUT /articles/:id ─────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to service with id, dto, and userId', async () => {
      const dto = { body: 'updated' };
      const updated = makeArticle({ body: 'updated' });
      mockArticlesService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(1, dto as never, mockReq(1));

      expect(mockArticlesService.update).toHaveBeenCalledWith(1, dto, 1);
      expect(ArticleSerializer.serializeOne).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.update.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        controller.update(1, { body: 'x' } as never, mockReq(99)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── PATCH /articles/:slug/publish ─────────────────────────────────────────

  describe('publish', () => {
    it('delegates to service and serializes result', async () => {
      const article = makeArticle({ status: 'published' });
      mockArticlesService.publish.mockResolvedValueOnce(article);

      const result = await controller.publish('hello', mockReq(1));

      expect(mockArticlesService.publish).toHaveBeenCalledWith('hello', 1);
      expect(ArticleSerializer.serializeOne).toHaveBeenCalled();
      expect(result).toEqual(article);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.publish.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        controller.publish('hello', mockReq(99)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── PATCH /articles/:slug/unpublish ───────────────────────────────────────

  describe('unpublish', () => {
    it('delegates to service and serializes result', async () => {
      const article = makeArticle({ status: 'draft' });
      mockArticlesService.unpublish.mockResolvedValueOnce(article);

      const result = await controller.unpublish('hello', mockReq(1));

      expect(mockArticlesService.unpublish).toHaveBeenCalledWith('hello', 1);
      expect(ArticleSerializer.serializeOne).toHaveBeenCalled();
      expect(result).toEqual(article);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.unpublish.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        controller.unpublish('hello', mockReq(99)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── DELETE /articles/:id ──────────────────────────────────────────────────

  describe('remove', () => {
    it('delegates to service with id and userId', async () => {
      mockArticlesService.remove.mockResolvedValueOnce(undefined);

      await controller.remove(1, mockReq(1));

      expect(mockArticlesService.remove).toHaveBeenCalledWith(1, 1);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.remove.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(controller.remove(1, mockReq(99))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        ArticlesController.prototype,
        'remove',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
