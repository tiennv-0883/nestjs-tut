import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CommentsService } from './comments.service';
import { Comment } from './comment.entity';
import { Article } from '../article.entity';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockCommentRepo = {
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
    ({ id: 1, ...overrides }) as Article;

  const makeComment = (overrides: Partial<Comment> = {}): Comment =>
    ({
      id: 1,
      body: 'Great post!',
      articleId: 1,
      authorId: 2,
      createdAt: new Date(),
      ...overrides,
    }) as Comment;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockI18nService.t.mockReturnValue('translated');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(Article), useValue: mockArticleRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findAllByArticle ──────────────────────────────────────────────────────

  describe('findAllByArticle', () => {
    it('returns comments for an existing article', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      const comments = [makeComment()];
      mockCommentRepo.find.mockResolvedValueOnce(comments);

      const result = await service.findAllByArticle(1);

      expect(mockCommentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { articleId: 1 } }),
      );
      expect(result).toEqual(comments);
    });

    it('throws NotFoundException when article does not exist', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findAllByArticle(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockCommentRepo.find).not.toHaveBeenCalled();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and saves a comment when article exists', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      const comment = makeComment();
      const commentWithAuthor = makeComment({
        author: { id: 2, email: 'a@test.com', name: 'A' } as never,
      });
      mockCommentRepo.create.mockReturnValueOnce(comment);
      mockCommentRepo.save.mockResolvedValueOnce(comment);
      mockCommentRepo.findOne.mockResolvedValueOnce(commentWithAuthor);

      const result = await service.create(1, { body: 'Great post!' }, 2);

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Great post!',
          articleId: 1,
          authorId: 2,
        }),
      );
      expect(mockCommentRepo.save).toHaveBeenCalledWith(comment);
      expect(mockCommentRepo.findOne).toHaveBeenCalledWith({
        where: { id: comment.id },
        relations: ['author'],
      });
      expect(result).toEqual(commentWithAuthor);
    });

    it('throws NotFoundException when article does not exist', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(99, { body: 'test' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockCommentRepo.create).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when save fails', async () => {
      mockArticleRepo.findOne.mockResolvedValueOnce(makeArticle());
      mockCommentRepo.create.mockReturnValueOnce(makeComment());
      mockCommentRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.create(1, { body: 'test' }, 2),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the comment when requester is the author', async () => {
      const comment = makeComment({ authorId: 5 });
      mockCommentRepo.findOne.mockResolvedValueOnce(comment);
      mockCommentRepo.remove.mockResolvedValueOnce(undefined);

      await service.remove(1, 1, 5);

      expect(mockCommentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, articleId: 1 },
      });
      expect(mockCommentRepo.remove).toHaveBeenCalledWith(comment);
    });

    it('throws NotFoundException when comment does not exist', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove(99, 1, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockCommentRepo.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when comment does not belong to the article', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce(null); // { id:1, articleId:99 } → not found

      await expect(service.remove(1, 99, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockCommentRepo.remove).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when requester is not the author', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce(
        makeComment({ authorId: 5 }),
      );

      await expect(service.remove(1, 1, 99)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockCommentRepo.remove).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when remove fails', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce(
        makeComment({ authorId: 5 }),
      );
      mockCommentRepo.remove.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.remove(1, 1, 5)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
