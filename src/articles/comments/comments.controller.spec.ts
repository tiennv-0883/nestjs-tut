import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

describe('CommentsController', () => {
  let controller: CommentsController;

  const mockCommentsService = {
    findAllByArticle: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockReq = (sub: number) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  const makeComment = (overrides = {}) => ({
    id: 1,
    body: 'Great post!',
    articleId: 1,
    authorId: 2,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: mockCommentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /articles/:articleId/comments ─────────────────────────────────────

  describe('findAll', () => {
    it('returns serialized comments for an article', async () => {
      const comments = [makeComment()];
      mockCommentsService.findAllByArticle.mockResolvedValueOnce(comments);

      const result = await controller.findAll(1);

      expect(mockCommentsService.findAllByArticle).toHaveBeenCalledWith(1);
      expect(result).toEqual(comments);
    });

    it('propagates NotFoundException when article does not exist', async () => {
      mockCommentsService.findAllByArticle.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(controller.findAll(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── POST /articles/:articleId/comments ────────────────────────────────────

  describe('create', () => {
    it('delegates to service with articleId, dto, and userId from JWT', async () => {
      const dto = { body: 'Great post!' };
      const comment = makeComment();
      mockCommentsService.create.mockResolvedValueOnce(comment);

      const result = await controller.create(1, dto, mockReq(2));

      expect(mockCommentsService.create).toHaveBeenCalledWith(1, dto, 2);
      expect(result).toEqual(comment);
    });

    it('propagates NotFoundException when article does not exist', async () => {
      mockCommentsService.create.mockRejectedValueOnce(new NotFoundException());

      await expect(
        controller.create(99, { body: 'x' }, mockReq(1)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        CommentsController.prototype,
        'create',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── DELETE /articles/:articleId/comments/:id ──────────────────────────────

  describe('remove', () => {
    it('delegates to service with comment id, articleId, and userId from JWT', async () => {
      mockCommentsService.remove.mockResolvedValueOnce(undefined);

      await controller.remove(1, 1, mockReq(2));

      expect(mockCommentsService.remove).toHaveBeenCalledWith(1, 1, 2);
    });

    it('propagates NotFoundException when comment does not exist', async () => {
      mockCommentsService.remove.mockRejectedValueOnce(new NotFoundException());

      await expect(controller.remove(1, 99, mockReq(2))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates ForbiddenException when requester is not the author', async () => {
      mockCommentsService.remove.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(controller.remove(1, 1, mockReq(99))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        CommentsController.prototype,
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
