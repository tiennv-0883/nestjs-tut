import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArticleMigration1775063973896 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`articles\` (
        \`id\`          INT           NOT NULL AUTO_INCREMENT,
        \`slug\`        VARCHAR(255)  NOT NULL,
        \`title\`       VARCHAR(255)  NOT NULL,
        \`description\` VARCHAR(255)  NULL,
        \`body\`        TEXT          NOT NULL,
        \`tags\`        JSON          NULL,
        \`status\`      VARCHAR(20)   NOT NULL DEFAULT 'draft',
        \`authorId\`    INT           NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_articles_slug\` (\`slug\`),
        CONSTRAINT \`FK_articles_author\`
          FOREIGN KEY (\`authorId\`) REFERENCES \`users\` (\`id\`)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`articles\``);
  }
}
