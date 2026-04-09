import { MigrationInterface, QueryRunner } from 'typeorm';

export class FavoritesMigration1775063973898 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`favorites\` (
        \`id\`        INT         NOT NULL AUTO_INCREMENT,
        \`userId\`    INT         NOT NULL,
        \`articleId\` INT         NOT NULL,
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_favorites_user_article\` (\`userId\`, \`articleId\`),
        CONSTRAINT \`FK_favorites_user\`
          FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE,
        CONSTRAINT \`FK_favorites_article\`
          FOREIGN KEY (\`articleId\`) REFERENCES \`articles\` (\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`favorites\``);
  }
}
