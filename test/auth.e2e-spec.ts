import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Server } from 'http';
import request from 'supertest';
import { createTestApp, clearTables } from './helpers/test-app';
import { createUser } from './helpers/factories';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let server: Server;

  beforeAll(async () => {
    ({ app, ds } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearTables(ds);
  });

  // ── POST /auth/signup ──────────────────────────────────────────────────────

  describe('POST /auth/signup', () => {
    it('creates a user and returns its data', async () => {
      const res = await request(server).post('/auth/signup').send({
        email: 'new@test.com',
        password: 'Password123',
        name: 'New User',
      });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(201);
      expect(body.email).toBe('new@test.com');
      expect(body.name).toBe('New User');
      expect(body.id).toBeDefined();
      expect(body.password).toBeUndefined();
    });

    it('returns 409 when email already exists', async () => {
      await createUser(ds, { email: 'dup@test.com' });

      const res = await request(server).post('/auth/signup').send({
        email: 'dup@test.com',
        password: 'Password123',
      });

      expect(res.status).toBe(409);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(server).post('/auth/signup').send({
        email: 'not-an-email',
        password: 'Password123',
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
      const res = await request(server).post('/auth/signup').send({
        email: 'a@test.com',
        password: '123',
      });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createUser(ds, {
        email: 'login@test.com',
        password: 'Password123',
      });
    });

    it('returns access_token and refresh_token on valid credentials', async () => {
      const res = await request(server).post('/auth/login').send({
        email: 'login@test.com',
        password: 'Password123',
      });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
      expect(typeof body.access_token).toBe('string');
      expect(typeof body.refresh_token).toBe('string');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(server).post('/auth/login').send({
        email: 'login@test.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
    });

    it('returns 401 when user does not exist', async () => {
      const res = await request(server).post('/auth/login').send({
        email: 'ghost@test.com',
        password: 'Password123',
      });

      expect(res.status).toBe(401);
    });

    it('the access_token is accepted by protected endpoints', async () => {
      const loginRes = await request(server).post('/auth/login').send({
        email: 'login@test.com',
        password: 'Password123',
      });
      const { access_token } = loginRes.body as {
        access_token: string;
        refresh_token: string;
      };

      const meRes = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${access_token}`);

      const meBody = meRes.body as Record<string, unknown>;
      expect(meRes.status).toBe(200);
      expect(meBody.email).toBe('login@test.com');
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await createUser(ds, {
        email: 'refresh@test.com',
        password: 'Password123',
      });
      const loginRes = await request(server).post('/auth/login').send({
        email: 'refresh@test.com',
        password: 'Password123',
      });
      refreshToken = (loginRes.body as { refresh_token: string }).refresh_token;
    });

    it('returns a new access_token for a valid refresh token', async () => {
      const res = await request(server)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.access_token).toBeDefined();
    });

    it('returns 401 for an invalid refresh token', async () => {
      const res = await request(server)
        .post('/auth/refresh')
        .send({ refresh_token: 'not-a-real-token' });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('revokes refresh token and returns a message', async () => {
      await createUser(ds, {
        email: 'logout@test.com',
        password: 'Password123',
      });
      const loginRes = await request(server).post('/auth/login').send({
        email: 'logout@test.com',
        password: 'Password123',
      });
      const { access_token, refresh_token } = loginRes.body as {
        access_token: string;
        refresh_token: string;
      };

      const res = await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ refresh_token });

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(200);
      expect(body.message).toBeDefined();
    });

    it('the refresh token cannot be used after logout', async () => {
      await createUser(ds, {
        email: 'logout2@test.com',
        password: 'Password123',
      });
      const loginRes = await request(server).post('/auth/login').send({
        email: 'logout2@test.com',
        password: 'Password123',
      });
      const { access_token, refresh_token } = loginRes.body as {
        access_token: string;
        refresh_token: string;
      };

      await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ refresh_token });

      const refreshRes = await request(server)
        .post('/auth/refresh')
        .send({ refresh_token });

      expect(refreshRes.status).toBe(401);
    });

    it('returns 401 when no access token is provided', async () => {
      const res = await request(server)
        .post('/auth/logout')
        .send({ refresh_token: 'any' });

      expect(res.status).toBe(401);
    });
  });
});
