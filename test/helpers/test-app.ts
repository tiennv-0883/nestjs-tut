import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

const TABLES = [
  'comments',
  'favorites',
  'follows',
  'refresh_tokens',
  'articles',
  'users',
];

export interface TestApp {
  app: INestApplication;
  ds: DataSource;
  jwtService: JwtService;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const ds = moduleRef.get<DataSource>(getDataSourceToken());

  await ds.synchronize();

  const jwtService = moduleRef.get<JwtService>(JwtService);

  return { app, ds, jwtService };
}

export async function clearTables(ds: DataSource): Promise<void> {
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await ds.query(`TRUNCATE TABLE \`${table}\``);
  }
  await ds.query('SET FOREIGN_KEY_CHECKS = 1');
}
