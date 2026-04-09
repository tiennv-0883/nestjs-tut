import { MigrationInterface, QueryRunner } from 'typeorm';

export class FollowsMigration1775063973899 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`follows\` (
        \`id\`          INT         NOT NULL AUTO_INCREMENT,
        \`followerId\`  INT         NOT NULL,
        \`followingId\` INT         NOT NULL,
        \`createdAt\`   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_follows_follower_following\` (\`followerId\`, \`followingId\`),
        CONSTRAINT \`FK_follows_follower\`
          FOREIGN KEY (\`followerId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE,
        CONSTRAINT \`FK_follows_following\`
          FOREIGN KEY (\`followingId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`follows\``);
  }
}
