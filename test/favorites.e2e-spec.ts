import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Server } from 'http';
import request from 'supertest';
import { createTestApp, clearTables } from './helpers/test-app';
import {
  createUser,
  createArticle,
  genToken,
  UserWithPassword,
} from './helpers/factories';
import { Article } from '../src/articles/article.entity';
import { Favorite } from '../src/articles/favorites/favorite.entity';

describe('Favorites (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let jwtService: JwtService;
  let server: Server;

  let user: UserWithPassword;
  let other: UserWithPassword;
  let article: Article;

  beforeAll(async () => {
    ({ app, ds, jwtService } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearTables(ds);
    user = await createUser(ds, { email: 'user@test.com', name: 'User' });
    other = await createUser(ds, { email: 'other@test.com', name: 'Other' });
    article = await createArticle(ds, other.id, {
      title: 'Article To Favorite',
      status: 'published',
    });
  });

  // ── GET /articles/favorites ───────────────────────────────────────────────

  describe('GET /articles/favorites', () => {
    it('returns empty array when user has no favorites', async () => {
      const token = genToken(jwtService, user);

      const res = await request(server)
        .get('/articles/favorites')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns favorited articles with nested article + author info', async () => {
      const token = genToken(jwtService, user);

      await request(server)
        .post(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server)
        .get('/articles/favorites')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      const resBody = res.body as Array<Record<string, unknown>>;
      const fav = resBody[0];
      expect(fav.articleId).toBe(article.id);
      expect(fav.article).toMatchObject({ id: article.id });
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).get('/articles/favorites');

      expect(res.status).toBe(401);
    });
  });

  // ── POST /articles/:articleId/favorite ────────────────────────────────────

  describe('POST /articles/:articleId/favorite', () => {
    it('favorites an article and returns the favorite with article info', async () => {
      const token = genToken(jwtService, user);

      const res = await request(server)
        .post(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(201);
      expect(body.articleId).toBe(article.id);
      expect(body.userId).toBe(user.id);
      expect(body.article).toMatchObject({
        id: article.id,
        title: article.title,
      });
    });

    it('returns 404 when article does not exist', async () => {
      const token = genToken(jwtService, user);

      const res = await request(server)
        .post('/articles/99999/favorite')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 409 when article is already favorited', async () => {
      const token = genToken(jwtService, user);

      await request(server)
        .post(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server)
        .post(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).post(
        `/articles/${article.id}/favorite`,
      );

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /articles/:articleId/favorite ──────────────────────────────────

  describe('DELETE /articles/:articleId/favorite', () => {
    it('unfavorites and returns 204', async () => {
      const token = genToken(jwtService, user);

      await request(server)
        .post(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      const deleteRes = await request(server)
        .delete(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);

      // verify it's actually gone
      const repo = ds.getRepository(Favorite);
      const count = await repo.count({
        where: { userId: user.id, articleId: article.id },
      });
      expect(count).toBe(0);
    });

    it('returns 404 when favorite does not exist', async () => {
      const token = genToken(jwtService, user);

      const res = await request(server)
        .delete(`/articles/${article.id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).delete(
        `/articles/${article.id}/favorite`,
      );

      expect(res.status).toBe(401);
    });
  });
});
