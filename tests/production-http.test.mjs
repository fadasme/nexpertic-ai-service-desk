import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { before, test } from 'node:test';

// Use only a disposable local server whose signing secret is supplied by the fixture.
const base = new URL(process.env.NEXPERTIC_TEST_BASE_URL ?? 'http://localhost:3001');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Production HTTP regressions require an isolated loopback server');
const secret = process.env.NEXERA_SESSION_SECRET;
if (!secret) throw new Error('Load the isolated server signing secret before running these tests');
const session = {
  id: 'production-test-user', email: 'requester@audit.example', name: 'Audit User',
  role: 'Usuario', permissions: ['ticket:create', 'ticket:read:self', 'knowledge:read'],
  tenantId: 'tenant-nexera-pilot', tenant: 'Audit', exp: Date.now() + 60000,
};
const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
const signature = createHmac('sha256', secret).update(payload).digest('base64url');
const cookie = `nexera_session=${payload}.${signature}`;
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  return { response, body: await response.json() };
}
before(async () => {
  const result = await request('/api/health');
  assert.equal(result.body.authMode, 'production');
  assert.equal(result.body.seedMode, 'production-clean');
});
test('production never discloses session identities to anonymous callers', async () => {
  for (const path of ['/api/auth/session', '/api/auth/session?role=Admin', '/api/auth/session?userId=admin-demo']) {
    const { response, body } = await request(path);
    assert.equal(response.status, 401, path);
    assert.equal(body.data, undefined);
  }
});
test('signed session cannot select another identity through query parameters', async () => {
  const { response, body } = await request('/api/auth/session?userId=admin-demo&role=Admin', { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.equal(body.data.id, session.id);
  assert.equal(body.data.role, 'Usuario');
  assert.equal(body.data.email, session.email);
});
test('profile update cannot change requester identity or issue a replacement cookie', async () => {
  const { response } = await request('/api/auth/session', {
    method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Another user', email: 'another-user@audit.example' }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.has('set-cookie'), false);
});
test('display name can change while identity, role and tenant remain fixed', async () => {
  const { response, body } = await request('/api/auth/session', {
    method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated name', email: session.email.toUpperCase(), role: 'Admin', tenantId: 'other-tenant', permissions: ['*'] }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.name, 'Updated name');
  assert.equal(body.data.email, session.email);
  assert.equal(body.data.role, session.role);
  assert.equal(body.data.tenantId, session.tenantId);
  assert.deepEqual(body.data.permissions, session.permissions);
  const nextCookie = response.headers.get('set-cookie').split(';')[0];
  const users = await request('/api/users', { headers: { cookie: nextCookie } });
  assert.equal(users.response.status, 403);
});
test('anonymous callers cannot edit profiles', async () => {
  const { response } = await request('/api/auth/session', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Anonymous' }),
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.has('set-cookie'), false);
});
