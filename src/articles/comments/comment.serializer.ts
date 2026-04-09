import { UserSerializer } from '../../users/user.serializer';

export type CommentSerializerType = 'DEFAULT';

const COMMENT_FIELDS: Record<CommentSerializerType, string[]> = {
  DEFAULT: ['id', 'body', 'articleId', 'createdAt', 'author'],
};

export class CommentSerializer {
  constructor(
    private readonly comment: Record<string, unknown>,
    private readonly options: { type: CommentSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return COMMENT_FIELDS[this.options.type] || [];
  }

  // Custom method — serializes the nested author via UserSerializer
  author(): Record<string, unknown> | null {
    if (!this.comment['author']) return null;
    return new UserSerializer(
      this.comment['author'] as Record<string, unknown>,
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
        } else if (this.comment[field] !== undefined) {
          acc[field] = this.comment[field];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  static serializeOne(
    comment: Record<string, unknown>,
    options: { type: CommentSerializerType },
  ): Record<string, unknown> {
    return new CommentSerializer(comment, options).serialize();
  }

  static serializeMany(
    comments: Record<string, unknown>[],
    options: { type: CommentSerializerType },
  ): Record<string, unknown>[] {
    return comments.map((c) => new CommentSerializer(c, options).serialize());
  }
}
