import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalAdminCredentials } from '../lib/nexera/runtime-config.ts';

test('local administrator requires an explicitly configured password', () => {
  const previous = process.env.NEXERA_LOCAL_ADMIN_PASSWORD;
  try {
    delete process.env.NEXERA_LOCAL_ADMIN_PASSWORD;
    assert.equal(getLocalAdminCredentials().enabled, false);
    process.env.NEXERA_LOCAL_ADMIN_PASSWORD = '   ';
    assert.equal(getLocalAdminCredentials().enabled, false);
    process.env.NEXERA_LOCAL_ADMIN_PASSWORD = 'test-only-configured-password';
    assert.equal(getLocalAdminCredentials().enabled, true);
  } finally {
    if (previous === undefined) delete process.env.NEXERA_LOCAL_ADMIN_PASSWORD;
    else process.env.NEXERA_LOCAL_ADMIN_PASSWORD = previous;
  }
});
