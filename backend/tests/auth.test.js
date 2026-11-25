import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
dotenv.config({ path: fileURLToPath(new URL('../.env.test', import.meta.url)) });

let app;
let pool;
let env;
let runMigrations;
let seedDatabase;

beforeAll(async () => {
  ({ default: app } = await import('../src/app.js'));
  ({ pool } = await import('../src/db/pool.js'));
  ({ env } = await import('../src/config/env.js'));
  ({ runMigrations } = await import('../src/db/migrate.js'));
  ({ seedDatabase } = await import('../src/db/seed.js'));

  await runMigrations();
  await pool.query('TRUNCATE messages, chat_sessions, tests, equipment, users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('auth', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
    });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice Again', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid email with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad Email', email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('rejects a short password with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short Pass', email: 'short@example.com', password: 'short' });

    expect(res.status).toBe(422);
  });

  it('ignores a client-supplied admin role on public register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@example.com', password: 'password123', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects /auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('forbids a normal user from an admin route', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('seeds idempotently and leaves exactly one admin', async () => {
    await seedDatabase();
    await seedDatabase();

    const { rows } = await pool.query(
      "SELECT count(*)::int AS total FROM users WHERE role = 'admin' AND lower(email) = $1",
      [env.ADMIN_EMAIL.toLowerCase()]
    );

    expect(rows[0].total).toBe(1);
  });
});
