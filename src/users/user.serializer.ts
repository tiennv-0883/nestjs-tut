export type UserSerializerType = 'BASIC_INFO' | 'PROFILE';

const USER_FIELDS: Record<UserSerializerType, string[]> = {
  BASIC_INFO: ['id', 'email', 'name'],
  PROFILE: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
};

export class UserSerializer {
  constructor(
    private readonly user: Record<string, any>,
    private readonly options: { type: UserSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return USER_FIELDS[this.options.type] || [];
  }

  serialize(): Record<string, any> {
    return this.allowedFields.reduce(
      (acc, field) => {
        if (this.user[field] !== undefined) {
          acc[field] = this.user[field];
        }
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  static serializeMany(
    users: Record<string, any>[],
    options: { type: UserSerializerType },
  ): Record<string, any>[] {
    return users.map((user) => new UserSerializer(user, options).serialize());
  }
}
