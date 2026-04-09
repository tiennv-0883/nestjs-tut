import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentsMigration1775063973897 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`comments\` (
        \`id\`        INT         NOT NULL AUTO_INCREMENT,
        \`body\`      TEXT        NOT NULL,
        \`articleId\` INT         NOT NULL,
        \`authorId\`  INT         NOT NULL,
        \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_comments_article\`
          FOREIGN KEY (\`articleId\`) REFERENCES \`articles\` (\`id\`)
          ON DELETE CASCADE,
        CONSTRAINT \`FK_comments_author\`
          FOREIGN KEY (\`authorId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`comments\``);
  }
}
