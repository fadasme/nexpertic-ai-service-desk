import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Miniflare, Log, LogLevel } from 'miniflare';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = resolve(root, 'dist/server/wrangler.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
let localEnv = {};
try { localEnv = parseEnv(readFileSync(resolve(root, '.env'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const runtimeEnv = { ...localEnv, ...process.env };
const bindings = Object.fromEntries(Object.entries(runtimeEnv).filter(([key, value]) => /^(NEXERA_|OIDC_|GLPI_)/.test(key) && typeof value === 'string'));
const port = Number(runtimeEnv.NEXPERTIC_VPS_PORT ?? 3008);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid VPS port');
const mf = new Miniflare({
  name: config.name ?? 'nexpertic-service-desk',
  scriptPath: resolve(dirname(configPath), config.main),
  modules: true,
  modulesRoot: dirname(configPath),
  modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings,
  host: '127.0.0.1',
  port,
  cf: false,
  log: new Log(LogLevel.INFO),
  d1Databases: Object.fromEntries((config.d1_databases ?? []).map((db) => [db.binding, db.database_id])),
  d1Persist: resolve(root, '.wrangler/state/v3/d1'),
  assets: {
    directory: resolve(dirname(configPath), config.assets.directory),
    binding: 'ASSETS',
    routerConfig: { has_user_worker: true },
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void mf.dispose().then(() => process.exit(0)); });
await mf.ready;
console.log(`Nexpertic compiled Worker listening on http://127.0.0.1:${port}`);
