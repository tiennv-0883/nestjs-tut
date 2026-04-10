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

describe('Articles (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let jwtService: JwtService;
  let server: Server;

  let author: UserWithPassword;
  let other: UserWithPassword;

  beforeAll(async () => {
    ({ app, ds, jwtService } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearTables(ds);
    author = await createUser(ds, { email: 'author@test.com', name: 'Author' });
    other = await createUser(ds, { email: 'other@test.com', name: 'Other' });
  });

  describe('GET /articles', () => {
    it('returns paginated published articles only', async () => {
      await createArticle(ds, author.id, {
        title: 'Published One',
        status: 'published',
      });
      await createArticle(ds, author.id, {
        title: 'Draft One',
        status: 'draft',
      });

      const res = await request(server).get('/articles');

      const body = res.body as {
        data: Array<Record<string, unknown>>;
        total: number;
        page: number;
        totalPages: number;
      };
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe('Published One');
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBe(1);
    });

    it('supports search filter', async () => {
      await createArticle(ds, author.id, {
        title: 'NestJS Tutorial',
        status: 'published',
      });
      await createArticle(ds, author.id, {
        title: 'React Guide',
        status: 'published',
      });

      const res = await request(server).get('/articles?search=NestJS');

      const body = res.body as { data: Array<Record<string, unknown>> };
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe('NestJS Tutorial');
    });

    it('supports authorId filter', async () => {
      await createArticle(ds, author.id, {
        title: 'Author Article',
        status: 'published',
      });
      await createArticle(ds, other.id, {
        title: 'Other Article',
        status: 'published',
      });

      const res = await request(server).get(`/articles?authorId=${author.id}`);
      const body = res.body as { data: Array<Record<string, unknown>> };

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe('Author Article');
    });

    it('returns empty data when no published articles exist', async () => {
      const res = await request(server).get('/articles');

      const body = res.body as { data: unknown[]; total: number };
      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /articles/me', () => {
    it('returns both draft and published articles for the authenticated user', async () => {
      await createArticle(ds, author.id, {
        title: 'My Draft',
        status: 'draft',
      });
      await createArticle(ds, author.id, {
        title: 'My Published',
        status: 'published',
      });
      await createArticle(ds, other.id, {
        title: 'Other Published',
        status: 'published',
      });
      const token = genToken(jwtService, author);

      const res = await request(server)
        .get('/articles/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).get('/articles/me');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /articles/:slug', () => {
    it('returns the published article by slug', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'Slug Test Article',
        status: 'published',
      });

      const res = await request(server).get(`/articles/${article.slug}`);

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.slug).toBe(article.slug);
      expect(body.title).toBe('Slug Test Article');
      expect(body.author).toMatchObject({
        id: author.id,
        email: author.email,
      });
    });

    it('returns 404 for a draft article', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'Draft Article',
        status: 'draft',
      });

      const res = await request(server).get(`/articles/${article.slug}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when article does not exist', async () => {
      const res = await request(server).get('/articles/non-existent-slug');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /articles', () => {
    it('creates an article and returns it', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post('/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Brand New Article', body: 'Article body content.' });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(201);
      expect(body.title).toBe('Brand New Article');
      expect(body.slug).toBe('brand-new-article');
      expect(body.status).toBe('draft');
      expect(body.author).toMatchObject({ id: author.id });
    });

    it('generates a unique slug when title conflicts', async () => {
      await createArticle(ds, author.id, { title: 'Same Title' });
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post('/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Same Title', body: 'body' });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(201);
      expect(body.slug).toBe('same-title-1');
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server)
        .post('/articles')
        .send({ title: 'Test', body: 'body' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when title is missing', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post('/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'no title' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /articles/:id', () => {
    let article: Article;

    beforeEach(async () => {
      article = await createArticle(ds, author.id, { title: 'Original Title' });
    });

    it('updates the article and returns it', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .put(`/articles/${article.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Updated body content' });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.body).toBe('Updated body content');
    });

    it('returns 403 when a different user tries to update', async () => {
      const token = genToken(jwtService, other);

      const res = await request(server)
        .put(`/articles/${article.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Hacked body' });

      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server)
        .put(`/articles/${article.id}`)
        .send({ body: 'body' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /articles/:slug/publish', () => {
    it('publishes a draft article', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'To Publish',
        status: 'draft',
      });
      const token = genToken(jwtService, author);

      const res = await request(server)
        .patch(`/articles/${article.slug}/publish`)
        .set('Authorization', `Bearer ${token}`);

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.status).toBe('published');
    });

    it('returns 403 when a different user tries to publish', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'Not Mine',
        status: 'draft',
      });
      const token = genToken(jwtService, other);

      const res = await request(server)
        .patch(`/articles/${article.slug}/publish`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /articles/:slug/unpublish', () => {
    it('unpublishes a published article back to draft', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'To Unpublish',
        status: 'published',
      });
      const token = genToken(jwtService, author);

      const res = await request(server)
        .patch(`/articles/${article.slug}/unpublish`)
        .set('Authorization', `Bearer ${token}`);

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.status).toBe('draft');
    });
  });

  describe('DELETE /articles/:id', () => {
    it('deletes the article and returns 204', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'To Delete',
        status: 'published',
      });
      const token = genToken(jwtService, author);

      const deleteRes = await request(server)
        .delete(`/articles/${article.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(server).get(`/articles/${article.slug}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 403 when a different user tries to delete', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'Protected',
        status: 'published',
      });
      const token = genToken(jwtService, other);

      const res = await request(server)
        .delete(`/articles/${article.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const article = await createArticle(ds, author.id, {
        title: 'Guarded',
        status: 'published',
      });

      const res = await request(server).delete(`/articles/${article.id}`);

      expect(res.status).toBe(401);
    });
  });
});
