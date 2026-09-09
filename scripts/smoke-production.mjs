const baseUrl = process.env.NEXPERTIC_PRODUCTION_BASE_URL ?? 'http://127.0.0.1:3008';
const checks = [];
const check = (name, ok, status) => checks.push({ name, ok: Boolean(ok), status });
async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
try {
  const { response, body } = await request('/api/health');
  check('health identifies Nexpertic', response.status === 200 && body.product === 'Nexpertic AI Service Desk', response.status);
  check('production authentication enabled', body.authMode === 'production', response.status);
  check('demo seeding disabled', body.seedMode === 'production-clean', response.status);
  check('consent uses a configured signing secret', body.security?.consentTokenSigning === 'configured', response.status);
  if (body.authMode === 'production') {
    for (const path of ['/api/auth/session', '/api/auth/session?role=Admin', '/api/auth/session?userId=admin-demo', '/api/users', '/api/tickets', '/api/persistence/status']) {
      const result = await request(path);
      check(`anonymous request denied: ${path}`, result.response.status === 401 && !result.body.data, result.response.status);
    }
    for (const path of ['/api/users', '/api/tickets?role=Admin']) {
      const result = await request(path, { headers: { 'x-nexera-role': 'Admin', 'x-nexera-tenant': 'tenant-nexera-pilot' } });
      check(`untrusted role denied: ${path}`, result.response.status === 401, result.response.status);
    }
    const demo = await request('/api/auth/session', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'admin-demo' }),
    });
    check('demo session issuance denied', demo.response.status === 403 && !demo.response.headers.has('set-cookie'), demo.response.status);
  }
} catch {
  check('server responds within 10 seconds', false, 'network error');
}
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name} (${item.status})`);
console.log(`${checks.filter((item) => item.ok).length}/${checks.length} production smoke checks passed.`);
console.log('Checks cover availability and anonymous access controls; authenticated persistence and real integrations require separate validation.');
if (checks.some((item) => !item.ok)) process.exitCode = 1;
