import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vitest-secret';
process.env.SMTP_HOST = '';
process.env.SMTP_FROM = '';

const require = createRequire(import.meta.url);
const request = require('supertest');
const jwt = require('jsonwebtoken');
const pkg = require('../package.json');
const { app, __test } = require('../server/index.cjs');

const JWT_OPTIONS = {
  issuer: 'safran-dashboard',
  audience: 'safran-dashboard',
  expiresIn: '5m',
};

function makeToken(role = 'user') {
  return jwt.sign(
    { sub: `${role}-user`, email: `${role}@safrangroup.com`, role },
    'vitest-secret',
    JWT_OPTIONS,
  );
}

function createPool(users = []) {
  const state = {
    users: users.map((u) => ({ ...u })),
    queries: [],
  };

  return {
    state,
    request() {
      const inputs = {};
      const req = {
        input(name, typeOrValue, maybeValue) {
          inputs[name] = arguments.length === 3 ? maybeValue : typeOrValue;
          return req;
        },
        async query(sqlText) {
          const text = String(sqlText);
          state.queries.push({ text, inputs: { ...inputs } });

          if (text.includes('FROM app_users') && text.includes('WHERE LOWER')) {
            const id = String(inputs.id || '').toLowerCase();
            const user = state.users.find((u) => (
              String(u.userId).toLowerCase() === id ||
              String(u.email).toLowerCase() === id
            ));
            return {
              recordset: user ? [{
                user_id: user.userId,
                email: user.email,
                role: user.role,
                pwd_hash: user.hash,
                must_reset: user.mustReset ? 1 : 0,
              }] : [],
              rowsAffected: [],
            };
          }

          if (text.includes('UPDATE app_users')) {
            const user = state.users.find((u) => u.userId === inputs.user_id);
            if (!user) return { recordset: [], rowsAffected: [0] };
            user.hash = inputs.pwd_hash;
            user.mustReset = false;
            return { recordset: [], rowsAffected: [1] };
          }

          return { recordset: [], rowsAffected: [1] };
        },
      };
      return req;
    },
  };
}

describe('API authentication and validation', () => {
  beforeEach(() => {
    __test.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the package version without authentication', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: pkg.version });
  });

  it('rejects unauthenticated protected endpoints before touching the database', async () => {
    const cases = [
      ['get', '/api/slurries'],
      ['get', '/api/rheology?slurryId=A&parameter=density'],
      ['get', '/api/rheology/all?slurryId=A'],
      ['get', '/api/rheology/bounds?slurryId=A'],
      ['get', '/api/rheology/latest-all?slurries=A'],
      ['get', '/api/rheology/export-csv?slurryId=A'],
      ['get', '/api/alerts/latest?slurries=A'],
      ['get', '/api/user-prefs'],
      ['put', '/api/user-prefs'],
      ['post', '/api/rheology/point'],
      ['post', '/api/rheology/import-csv'],
      ['post', '/api/support'],
    ];

    for (const [method, path] of cases) {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authorization|Invalid/);
    }
  });

  it('returns validation errors for malformed auth, support, and write payloads', async () => {
    const adminToken = makeToken('admin');

    const login = await request(app).post('/api/auth/login').send({});
    expect(login.status).toBe(400);

    const resetConfirm = await request(app).post('/api/auth/reset-confirm').send({});
    expect(resetConfirm.status).toBe(400);

    const support = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'bad', subject: 'x', message: 'y' });
    expect(support.status).toBe(400);

    const point = await request(app)
      .post('/api/rheology/point')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parameter: 'density' });
    expect(point.status).toBe(400);
  });
});

describe('login flow', () => {
  beforeEach(() => {
    __test.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in a user with a valid scrypt password and audits the login', async () => {
    const hash = await __test.scryptHash('correct-password');
    const pool = createPool([
      { userId: 'alice', email: 'alice@safrangroup.com', role: 'admin', hash, mustReset: false },
    ]);
    __test.setPool(pool);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'alice', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.token).toBeTruthy();
    const payload = jwt.verify(res.body.token, 'vitest-secret', JWT_OPTIONS);
    expect(payload.sub).toBe('alice');
    expect(pool.state.queries.some((q) => q.text.includes('audit_log'))).toBe(true);
  });

  it('rejects bad passwords and unknown users generically', async () => {
    const hash = await __test.scryptHash('correct-password');
    __test.setPool(createPool([
      { userId: 'alice', email: 'alice@safrangroup.com', role: 'user', hash, mustReset: false },
    ]));

    const badPassword = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'alice', password: 'wrong' });
    expect(badPassword.status).toBe(401);
    expect(badPassword.body.error).toBe('Invalid credentials');

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody', password: 'whatever' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe('Invalid credentials');
  });

  it('returns mustReset without issuing a JWT for seeded users', async () => {
    const hash = await __test.scryptHash('temporary-password');
    __test.setPool(createPool([
      { userId: 'bob', email: 'bob@safrangroup.com', role: 'user', hash, mustReset: true },
    ]));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'bob@safrangroup.com', password: 'temporary-password' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mustReset).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user.userId).toBe('bob');
  });
});

describe('reset and support opacity', () => {
  beforeEach(() => {
    __test.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps reset-request responses opaque for empty, missing, and existing users', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const hash = await __test.scryptHash('temporary-password');
    __test.setPool(createPool([
      { userId: 'carol', email: 'carol@safrangroup.com', role: 'user', hash, mustReset: false },
    ]));

    const empty = await request(app).post('/api/auth/reset-request').send({ identifier: '' });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ ok: true });

    const missing = await request(app).post('/api/auth/reset-request').send({ identifier: 'missing' });
    expect(missing.status).toBe(200);
    expect(missing.body).toEqual({ ok: true });

    const existing = await request(app).post('/api/auth/reset-request').send({ identifier: 'carol' });
    expect(existing.status).toBe(200);
    expect(existing.body).toEqual({ ok: true });
    expect(existing.body.token).toBeUndefined();
    expect(existing.body.to).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('returns 503 for support submissions when SMTP is not configured', async () => {
    const res = await request(app)
      .post('/api/support')
      .set('Authorization', `Bearer ${makeToken('user')}`)
      .send({ category: 'question', subject: 'Need help', message: 'Please check this.' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('smtp unavailable');
  });
});
