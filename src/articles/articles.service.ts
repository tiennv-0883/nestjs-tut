import {
  ForbiddenException,
  Injectable,
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

  async create(dto: CreateArticleDto, authorId: number): Promise<Article> {
    const slug = await this.uniqueSlug(Article.slugify(dto.title));
    const article = this.articleRepo.create({
      ...dto,
      slug,
      authorId,
      tags: dto.tags ?? null,
      description: dto.description ?? null,
      status: dto.status ?? 'draft',
    });
    return this.articleRepo.save(article);
  }

  async update(
    slug: string,
    dto: UpdateArticleDto,
    requesterId: number,
  ): Promise<Article> {
    const article = await this.findBySlug(slug);
    this.assertOwner(article, requesterId);

    if (dto.title && dto.title !== article.title) {
      article.slug = await this.uniqueSlug(
        Article.slugify(dto.title),
        article.id,
      );
    }

    Object.assign(article, dto);
    return this.articleRepo.save(article);
  }

  async remove(slug: string, requesterId: number): Promise<void> {
    const article = await this.findBySlug(slug);
    this.assertOwner(article, requesterId);
    await this.articleRepo.remove(article);
  }

  private assertOwner(article: Article, userId: number): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException(t(this.i18n, 'article.forbidden'));
    }
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
