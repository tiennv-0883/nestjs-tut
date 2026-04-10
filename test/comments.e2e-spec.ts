import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Server } from 'http';
import request from 'supertest';
import { createTestApp, clearTables } from './helpers/test-app';
import {
  createUser,
  createArticle,
  createComment,
  genToken,
  UserWithPassword,
} from './helpers/factories';
import { Article } from '../src/articles/article.entity';

describe('Comments (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let jwtService: JwtService;
  let server: Server;

  let author: UserWithPassword;
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

    author = await createUser(ds, { email: 'author@test.com', name: 'Author' });
    other = await createUser(ds, { email: 'other@test.com', name: 'Other' });
    article = await createArticle(ds, author.id, {
      title: 'Integration Test Article',
      status: 'published',
    });
  });

  // ── GET /articles/:articleId/comments ──────────────────────────────────────

  describe('GET /articles/:articleId/comments', () => {
    it('returns 200 with an empty array when there are no comments', async () => {
      const res = await request(server).get(`/articles/${article.id}/comments`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns serialized comments with nested author info', async () => {
      await createComment(ds, article.id, author.id, 'First comment');
      await createComment(ds, article.id, other.id, 'Second comment');

      const res = await request(server).get(`/articles/${article.id}/comments`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const [first, second] = res.body as Array<Record<string, unknown>>;

      expect(first.body).toBe('First comment');
      expect(first.articleId).toBe(article.id);
      expect(first.id).toBeDefined();
      expect(first.createdAt).toBeDefined();
      expect(first.author).toMatchObject({
        id: author.id,
        email: author.email,
        name: author.name,
      });

      expect(second.body).toBe('Second comment');
      expect((second.author as Record<string, unknown>).id).toBe(other.id);
    });

    it('returns 404 when the article does not exist', async () => {
      const res = await request(server).get('/articles/99999/comments');

      expect(res.status).toBe(404);
    });
  });

  // ── POST /articles/:articleId/comments ─────────────────────────────────────

  describe('POST /articles/:articleId/comments', () => {
    it('creates a comment and returns it with author info', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post(`/articles/${article.id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'A brand new comment' });

      expect(res.status).toBe(201);
      const body = res.body as Record<string, unknown>;
      expect(body.body).toBe('A brand new comment');
      expect(body.articleId).toBe(article.id);
      expect(body.id).toBeDefined();
      expect(body.author).toMatchObject({
        id: author.id,
        email: author.email,
      });
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server)
        .post(`/articles/${article.id}/comments`)
        .send({ body: 'sneaky comment' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when the article does not exist', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post('/articles/99999/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'comment on ghost article' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when body is empty', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post(`/articles/${article.id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: '' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when body field is missing', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post(`/articles/${article.id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when an unknown field is sent', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .post(`/articles/${article.id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'valid', unknown: 'field' });

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /articles/:articleId/comments/:id ───────────────────────────────

  describe('DELETE /articles/:articleId/comments/:id', () => {
    it('deletes the comment and returns 204 when the requester is the owner', async () => {
      const comment = await createComment(
        ds,
        article.id,
        author.id,
        'Delete me',
      );
      const token = genToken(jwtService, author);

      const deleteRes = await request(server)
        .delete(`/articles/${article.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);

      const listRes = await request(server).get(
        `/articles/${article.id}/comments`,
      );
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 403 when a different user tries to delete the comment', async () => {
      const comment = await createComment(ds, article.id, author.id, 'Mine');
      const token = genToken(jwtService, other);

      const res = await request(server)
        .delete(`/articles/${article.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 when the comment does not exist', async () => {
      const token = genToken(jwtService, author);

      const res = await request(server)
        .delete(`/articles/${article.id}/comments/99999`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 when no token is provided', async () => {
      const comment = await createComment(
        ds,
        article.id,
        author.id,
        'Unguarded',
      );

      const res = await request(server).delete(
        `/articles/${article.id}/comments/${comment.id}`,
      );

      expect(res.status).toBe(401);
    });
  });
});
