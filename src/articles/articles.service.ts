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
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { t } from '../shared/util';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly i18n: I18nService,
  ) {}

  async findAll(): Promise<Article[]> {
    return this.articleRepo.find({
      where: { status: 'published' },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByAuthor(authorId: number): Promise<Article[]> {
    return this.articleRepo.find({
      where: { authorId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
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
        t(this.i18n, 'article.not-found', { slug: String(id) }),
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
    return this.saveWithSlugRetry(article, baseSlug);
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
    return baseSlug
      ? this.saveWithSlugRetry(article, baseSlug, article.id)
      : this.articleRepo.save(article);
  }

  async remove(id: number, requesterId: number): Promise<void> {
    const article = await this.findById(id);
    this.assertOwner(article, requesterId);
    await this.articleRepo.remove(article);
  }

  async publish(slug: string, requesterId: number): Promise<Article> {
    const article = await this.findBySlug(slug);
    this.assertOwner(article, requesterId);
    article.status = 'published';
    return this.articleRepo.save(article);
  }

  async unpublish(slug: string, requesterId: number): Promise<Article> {
    const article = await this.findBySlug(slug);
    this.assertOwner(article, requesterId);
    article.status = 'draft';
    return this.articleRepo.save(article);
  }

  private assertOwner(article: Article, userId: number): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException(t(this.i18n, 'article.forbidden'));
    }
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
        if (!this.isDuplicateSlugError(error) || attempt === MAX_RETRIES - 1) {
          throw error;
        }
        article.slug = await this.uniqueSlug(baseSlug, excludeId);
      }
    }
    throw new InternalServerErrorException(
      'Failed to generate a unique slug after retries',
    );
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
