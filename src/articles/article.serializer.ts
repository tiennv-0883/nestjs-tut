import { UserSerializer } from '../users/user.serializer';
import { PaginatedArticles } from './dto/query-article.dto';

export type ArticleSerializerType = 'SUMMARY' | 'DETAIL';

const ARTICLE_FIELDS: Record<ArticleSerializerType, string[]> = {
  SUMMARY: [
    'id',
    'slug',
    'title',
    'description',
    'tags',
    'status',
    'createdAt',
    'author',
  ],
  DETAIL: [
    'id',
    'slug',
    'title',
    'description',
    'body',
    'tags',
    'status',
    'createdAt',
    'updatedAt',
    'author',
  ],
};

export class ArticleSerializer {
  constructor(
    private readonly article: Record<string, unknown>,
    private readonly options: { type: ArticleSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return ARTICLE_FIELDS[this.options.type] || [];
  }

  // Custom method — overrides plain property access for "author" field
  author(): Record<string, unknown> | null {
    if (!this.article['author']) return null;
    return new UserSerializer(
      this.article['author'] as Record<string, unknown>,
      { type: 'BASIC_INFO' },
    ).serialize();
  }

  serialize(): Record<string, unknown> {
    const proto = Object.getPrototypeOf(this) as Record<string, unknown>;
    return this.allowedFields.reduce(
      (acc, field) => {
        // If a method with this name exists on the serializer, call it
        if (typeof proto[field] === 'function') {
          const self = this as unknown as Record<string, () => unknown>;
          acc[field] = self[field]();
        } else if (this.article[field] !== undefined) {
          acc[field] = this.article[field];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  static serializeOne(
    article: Record<string, unknown>,
    options: { type: ArticleSerializerType },
  ): Record<string, unknown> {
    return new ArticleSerializer(article, options).serialize();
  }

  static serializeMany(
    articles: Record<string, unknown>[],
    options: { type: ArticleSerializerType },
  ): Record<string, unknown>[] {
    return articles.map((article) =>
      new ArticleSerializer(article, options).serialize(),
    );
  }

  static serializePaginated(
    result: PaginatedArticles<Record<string, unknown>>,
    options: { type: ArticleSerializerType },
  ): Omit<PaginatedArticles<Record<string, unknown>>, 'data'> & {
    data: Record<string, unknown>[];
  } {
    return {
      ...result,
      data: ArticleSerializer.serializeMany(result.data, options),
    };
  }
}
