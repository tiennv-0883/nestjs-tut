import { ArticleSerializer } from '../article.serializer';

export type FavoriteSerializerType = 'DEFAULT';

const FAVORITE_FIELDS: Record<FavoriteSerializerType, string[]> = {
  DEFAULT: ['id', 'userId', 'articleId', 'createdAt', 'article'],
};

export class FavoriteSerializer {
  constructor(
    private readonly favorite: Record<string, unknown>,
    private readonly options: { type: FavoriteSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return FAVORITE_FIELDS[this.options.type] || [];
  }

  article(): Record<string, unknown> | null {
    if (!this.favorite['article']) return null;
    return ArticleSerializer.serializeOne(
      this.favorite['article'] as Record<string, unknown>,
      { type: 'SUMMARY' },
    );
  }

  serialize(): Record<string, unknown> {
    const proto = Object.getPrototypeOf(this) as Record<string, unknown>;
    return this.allowedFields.reduce(
      (acc, field) => {
        if (typeof proto[field] === 'function') {
          const self = this as unknown as Record<string, () => unknown>;
          acc[field] = self[field]();
        } else if (this.favorite[field] !== undefined) {
          acc[field] = this.favorite[field];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  static serializeOne(
    favorite: Record<string, unknown>,
    options: { type: FavoriteSerializerType },
  ): Record<string, unknown> {
    return new FavoriteSerializer(favorite, options).serialize();
  }

  static serializeMany(
    favorites: Record<string, unknown>[],
    options: { type: FavoriteSerializerType },
  ): Record<string, unknown>[] {
    return favorites.map((f) => new FavoriteSerializer(f, options).serialize());
  }
}
