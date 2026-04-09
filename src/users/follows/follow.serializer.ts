import { UserSerializer } from '../user.serializer';

export type FollowSerializerType = 'DEFAULT';

const FOLLOW_FIELDS: Record<FollowSerializerType, string[]> = {
  DEFAULT: ['id', 'followerId', 'followingId', 'createdAt', 'following'],
};

export class FollowSerializer {
  constructor(
    private readonly follow: Record<string, unknown>,
    private readonly options: { type: FollowSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return FOLLOW_FIELDS[this.options.type] || [];
  }

  following(): Record<string, unknown> | null {
    if (!this.follow['following']) return null;
    return new UserSerializer(
      this.follow['following'] as Record<string, unknown>,
      { type: 'BASIC_INFO' },
    ).serialize();
  }

  serialize(): Record<string, unknown> {
    const proto = Object.getPrototypeOf(this) as Record<string, unknown>;
    return this.allowedFields.reduce(
      (acc, field) => {
        if (typeof proto[field] === 'function') {
          const self = this as unknown as Record<string, () => unknown>;
          acc[field] = self[field]();
        } else if (this.follow[field] !== undefined) {
          acc[field] = this.follow[field];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  static serializeOne(
    follow: Record<string, unknown>,
    options: { type: FollowSerializerType },
  ): Record<string, unknown> {
    return new FollowSerializer(follow, options).serialize();
  }

  static serializeMany(
    follows: Record<string, unknown>[],
    options: { type: FollowSerializerType },
  ): Record<string, unknown>[] {
    return follows.map((f) => new FollowSerializer(f, options).serialize());
  }
}
