import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Comment } from './comment.entity';
import { Article } from '../article.entity';
import { CommentSerializer } from './comment.serializer';
import { CreateCommentDto } from './dto/create-comment.dto';
import { t } from '../../shared/util';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly i18n: I18nService,
  ) {}

  async findAllByArticle(
    articleId: number,
  ): Promise<Record<string, unknown>[]> {
    await this.findArticleOrFail(articleId);
    const comments = await this.commentRepo.find({
      where: { articleId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
    return CommentSerializer.serializeMany(
      comments as unknown as Record<string, unknown>[],
      { type: 'DEFAULT' },
    );
  }

  async create(
    articleId: number,
    dto: CreateCommentDto,
    authorId: number,
  ): Promise<Record<string, unknown>> {
    await this.findArticleOrFail(articleId);
    const comment = this.commentRepo.create({ ...dto, articleId, authorId });
    const saved = await this.dbSave(() => this.commentRepo.save(comment));
    const full = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
    return CommentSerializer.serializeOne(
      full as unknown as Record<string, unknown>,
      { type: 'DEFAULT' },
    );
  }

  async remove(
    id: number,
    articleId: number,
    requesterId: number,
  ): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id, articleId },
    });
    if (!comment) {
      throw new NotFoundException(t(this.i18n, 'comment.not-found', { id }));
    }
    if (comment.authorId !== requesterId) {
      throw new ForbiddenException(t(this.i18n, 'comment.forbidden'));
    }
    try {
      await this.commentRepo.remove(comment);
    } catch {
      throw new InternalServerErrorException(
        t(this.i18n, 'comment.delete-failed'),
      );
    }
  }

  private async dbSave<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        t(this.i18n, 'comment.save-failed'),
      );
    }
  }

  private async findArticleOrFail(articleId: number): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { id: articleId },
    });
    if (!article) {
      throw new NotFoundException(
        t(this.i18n, 'article.not-found-by-id', { id: articleId }),
      );
    }
    return article;
  }
}
