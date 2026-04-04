import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('ArticlesController', () => {
  let controller: ArticlesController;

  const mockArticlesService = {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockReq = (sub: number) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  beforeEach(async () => {
    jest.clearAllMocks();

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
    it('returns an array of articles', async () => {
      const articles = [{ id: 1, slug: 'hello' }];
      mockArticlesService.findAll.mockResolvedValueOnce(articles);

      expect(await controller.findAll()).toEqual(articles);
      expect(mockArticlesService.findAll).toHaveBeenCalled();
    });
  });

  // ── GET /articles/:slug ───────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns article by slug', async () => {
      const article = { id: 1, slug: 'hello' };
      mockArticlesService.findBySlug.mockResolvedValueOnce(article);

      expect(await controller.findOne('hello')).toEqual(article);
      expect(mockArticlesService.findBySlug).toHaveBeenCalledWith('hello');
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
    it('delegates to service with authorId from JWT', async () => {
      const dto = { title: 'Hello', body: 'World' };
      const created = { id: 1, slug: 'hello', ...dto };
      mockArticlesService.create.mockResolvedValueOnce(created);

      const result = await controller.create(dto, mockReq(7));

      expect(mockArticlesService.create).toHaveBeenCalledWith(dto, 7);
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

  // ── PUT /articles/:slug ───────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to service with slug, dto, and userId', async () => {
      const dto = { body: 'updated' };
      const updated = { id: 1, slug: 'hello', body: 'updated' };
      mockArticlesService.update.mockResolvedValueOnce(updated);

      const result = await controller.update('hello', dto, mockReq(1));

      expect(mockArticlesService.update).toHaveBeenCalledWith('hello', dto, 1);
      expect(result).toEqual(updated);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.update.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        controller.update('hello', { body: 'x' }, mockReq(99)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── DELETE /articles/:slug ────────────────────────────────────────────────

  describe('remove', () => {
    it('delegates to service with slug and userId', async () => {
      mockArticlesService.remove.mockResolvedValueOnce(undefined);

      await controller.remove('hello', mockReq(1));

      expect(mockArticlesService.remove).toHaveBeenCalledWith('hello', 1);
    });

    it('propagates ForbiddenException when not the author', async () => {
      mockArticlesService.remove.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        controller.remove('hello', mockReq(99)),
      ).rejects.toBeInstanceOf(ForbiddenException);
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
