import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Server } from 'http';
import request from 'supertest';
import { createTestApp, clearTables } from './helpers/test-app';
import { createUser, genToken, UserWithPassword } from './helpers/factories';
import { Follow } from '../src/users/follows/follow.entity';

describe('Follows (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let jwtService: JwtService;
  let server: Server;

  let follower: UserWithPassword;
  let target: UserWithPassword;
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
    follower = await createUser(ds, {
      email: 'follower@test.com',
      name: 'Follower',
    });
    target = await createUser(ds, {
      email: 'target@test.com',
      name: 'Target',
    });
    other = await createUser(ds, {
      email: 'other@test.com',
      name: 'Other',
    });
  });

  // ── GET /users/followings ──────────────────────────────────────────────────

  describe('GET /users/followings', () => {
    it('returns empty array when user follows nobody', async () => {
      const token = genToken(jwtService, follower);

      const res = await request(server)
        .get('/users/followings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns followings with nested following user info', async () => {
      const token = genToken(jwtService, follower);

      await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server)
        .get('/users/followings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      const resBody = res.body as Array<Record<string, unknown>>;
      const follow = resBody[0];
      expect(follow.followingId).toBe(target.id);
      expect(follow.following).toMatchObject({
        id: target.id,
        email: target.email,
      });
    });

    it('only returns followings for the authenticated user', async () => {
      const followerToken = genToken(jwtService, follower);
      const otherToken = genToken(jwtService, other);

      // other follows target
      await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${otherToken}`);

      // follower's list should be empty
      const res = await request(server)
        .get('/users/followings')
        .set('Authorization', `Bearer ${followerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).get('/users/followings');

      expect(res.status).toBe(401);
    });
  });

  // ── POST /users/:userId/follow ────────────────────────────────────────────

  describe('POST /users/:userId/follow', () => {
    it('follows a user and returns the follow with following info', async () => {
      const token = genToken(jwtService, follower);

      const res = await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      const body = res.body as Record<string, unknown>;
      expect(res.status).toBe(201);
      expect(body.followingId).toBe(target.id);
      expect(body.followerId).toBe(follower.id);
      expect(body.following).toMatchObject({
        id: target.id,
        email: target.email,
      });
    });

    it('returns 400 when trying to follow self', async () => {
      const token = genToken(jwtService, follower);

      const res = await request(server)
        .post(`/users/${follower.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 when target user does not exist', async () => {
      const token = genToken(jwtService, follower);

      const res = await request(server)
        .post('/users/99999/follow')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 409 when already following the user', async () => {
      const token = genToken(jwtService, follower);

      await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).post(`/users/${target.id}/follow`);

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /users/:userId/follow ──────────────────────────────────────────

  describe('DELETE /users/:userId/follow', () => {
    it('unfollows and returns 204', async () => {
      const token = genToken(jwtService, follower);

      await request(server)
        .post(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      const deleteRes = await request(server)
        .delete(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);

      // verify row is actually gone
      const count = await ds
        .getRepository(Follow)
        .count({ where: { followerId: follower.id, followingId: target.id } });
      expect(count).toBe(0);
    });

    it('returns 404 when not following the user', async () => {
      const token = genToken(jwtService, follower);

      const res = await request(server)
        .delete(`/users/${target.id}/follow`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(server).delete(`/users/${target.id}/follow`);

      expect(res.status).toBe(401);
    });
  });
});
