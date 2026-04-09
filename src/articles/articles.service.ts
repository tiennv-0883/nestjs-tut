import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Article } from './article.entity';
import type { ArticleStatus } from './article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PaginatedArticles, QueryArticleDto } from './dto/query-article.dto';
import { t, dbSave } from '../shared/util';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly i18n: I18nService,
  ) {}

  async findAll(query: QueryArticleDto): Promise<PaginatedArticles<Article>> {
    const { page = 1, limit = 10, search, authorId } = query;

    const qb = this.articleRepo
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .where('article.status = :status', { status: 'published' })
      .orderBy('article.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (authorId) {
      qb.andWhere('article.authorId = :authorId', { authorId });
    }

    if (search) {
      qb.andWhere(
        '(article.title LIKE :search OR article.description LIKE :search OR article.body LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByAuthor(authorId: number): Promise<Article[]> {
    return this.articleRepo.find({
      where: { authorId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPublishedBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { slug, status: 'published' },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(t(this.i18n, 'article.not-found', { slug }));
    }
    return article;
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { slug },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(t(this.i18n, 'article.not-found', { slug }));
    }
    return article;
  }

  async findById(id: number): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(
        t(this.i18n, 'article.not-found-by-id', { id }),
      );
    }
    return article;
  }

  async create(dto: CreateArticleDto, authorId: number): Promise<Article> {
    const baseSlug = Article.slugify(dto.title);
    const slug = await this.uniqueSlug(baseSlug);
    const article = this.articleRepo.create({
      ...dto,
      slug,
      authorId,
      tags: dto.tags ?? null,
      description: dto.description ?? null,
      status: dto.status ?? 'draft',
    });
    return dbSave(
      () => this.saveWithSlugRetry(article, baseSlug),
      t(this.i18n, 'article.save-failed'),
    );
  }

  async update(
    id: number,
    dto: UpdateArticleDto,
    requesterId: number,
  ): Promise<Article> {
    const article = await this.findById(id);
    this.assertOwner(article, requesterId);

    let baseSlug: string | null = null;
    if (dto.title && dto.title !== article.title) {
      baseSlug = Article.slugify(dto.title);
      article.slug = await this.uniqueSlug(baseSlug, article.id);
    }

    Object.assign(article, dto);
    return dbSave(
      () =>
        baseSlug
          ? this.saveWithSlugRetry(article, baseSlug, article.id)
          : this.articleRepo.save(article),
      t(this.i18n, 'article.save-failed'),
    );
  }

  async remove(id: number, requesterId: number): Promise<void> {
    const article = await this.findById(id);
    this.assertOwner(article, requesterId);
    try {
      await this.articleRepo.remove(article);
    } catch {
      const msg = t(this.i18n, 'article.delete-failed');
      throw new InternalServerErrorException(msg);
    }
  }

  async publish(slug: string, requesterId: number): Promise<Article> {
    return this.setStatus(slug, requesterId, 'published');
  }

  async unpublish(slug: string, requesterId: number): Promise<Article> {
    return this.setStatus(slug, requesterId, 'draft');
  }

  private assertOwner(article: Article, userId: number): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException(t(this.i18n, 'article.forbidden'));
    }
  }

  private async setStatus(
    slug: string,
    requesterId: number,
    status: ArticleStatus,
  ): Promise<Article> {
    const article = await this.findBySlug(slug);
    this.assertOwner(article, requesterId);
    article.status = status;
    return dbSave(
      () => this.articleRepo.save(article),
      t(this.i18n, 'article.save-failed'),
    );
  }

  private isDuplicateSlugError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ER_DUP_ENTRY'
    );
  }

  private async saveWithSlugRetry(
    article: Article,
    baseSlug: string,
    excludeId?: number,
  ): Promise<Article> {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.articleRepo.save(article);
      } catch (error) {
        if (!this.isDuplicateSlugError(error)) {
          const msg = t(this.i18n, 'article.save-failed');
          throw new InternalServerErrorException(msg);
        }
        if (attempt === MAX_RETRIES - 1) {
          const msg = t(this.i18n, 'article.slug-conflict');
          throw new InternalServerErrorException(msg);
        }
        article.slug = await this.uniqueSlug(baseSlug, excludeId);
      }
    }
    const msg = t(this.i18n, 'article.slug-conflict');
    throw new InternalServerErrorException(msg);
  }

  private async uniqueSlug(base: string, excludeId?: number): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
      const existing = await this.articleRepo.findOne({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }
}
