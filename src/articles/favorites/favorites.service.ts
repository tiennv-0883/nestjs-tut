import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Favorite } from './favorite.entity';
import { Article } from '../article.entity';
import { FavoriteSerializer } from './favorite.serializer';
import { dbSave, t } from '../../shared/util';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly i18n: I18nService,
  ) {}

  async findMyFavorites(userId: number): Promise<Record<string, unknown>[]> {
    const favorites = await this.favoriteRepo.find({
      where: { userId },
      relations: ['article', 'article.author'],
      order: { createdAt: 'DESC' },
    });
    return FavoriteSerializer.serializeMany(
      favorites as unknown as Record<string, unknown>[],
      { type: 'DEFAULT' },
    );
  }

  async favorite(
    articleId: number,
    userId: number,
  ): Promise<Record<string, unknown>> {
    const article = await this.articleRepo.findOne({
      where: { id: articleId },
      relations: ['author'],
    });
    if (!article) {
      throw new NotFoundException(
        t(this.i18n, 'favorite.article-not-found', { id: articleId }),
      );
    }

    const existing = await this.favoriteRepo.findOne({
      where: { userId, articleId },
    });
    if (existing) {
      throw new ConflictException(t(this.i18n, 'favorite.already-favorited'));
    }

    const favorite = this.favoriteRepo.create({ userId, articleId });
    const saved = await dbSave(
      () => this.favoriteRepo.save(favorite),
      t(this.i18n, 'favorite.save-failed'),
      t(this.i18n, 'favorite.already-favorited'),
    );
    saved.article = article;
    return FavoriteSerializer.serializeOne(
      saved as unknown as Record<string, unknown>,
      { type: 'DEFAULT' },
    );
  }

  async unfavorite(articleId: number, userId: number): Promise<void> {
    const favorite = await this.favoriteRepo.findOne({
      where: { userId, articleId },
    });
    if (!favorite) {
      throw new NotFoundException(t(this.i18n, 'favorite.not-found'));
    }
    try {
      await this.favoriteRepo.remove(favorite);
    } catch {
      throw new InternalServerErrorException(
        t(this.i18n, 'favorite.delete-failed'),
      );
    }
  }
}
