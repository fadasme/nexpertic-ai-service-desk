import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifestUrl = new URL("lib/nexera/persistence/migrations.json", root);
const schemaUrl = new URL("lib/nexera/persistence/001-initial-schema.sql", root);
const drizzleSchemaUrl = new URL("db/schema.ts", root);
const baselineSeedUrl = new URL("lib/nexera/persistence/seeds/001-pilot-baseline.sql", root);
const demoSeedUrl = new URL("lib/nexera/persistence/seeds/002-demo-data.sql", root);

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const sql = await readFile(schemaUrl, "utf8");
const drizzleSchema = await readFile(drizzleSchemaUrl, "utf8");
const baselineSeed = await readFile(baselineSeedUrl, "utf8");
const demoSeed = await readFile(demoSeedUrl, "utf8");

assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(
  manifest.migrations.map((migration) => migration.file),
  ["001-initial-schema.sql"],
);
assert.deepEqual(
  manifest.seeds.map((seed) => seed.file),
  ["seeds/001-pilot-baseline.sql", "seeds/002-demo-data.sql"],
);

for (const table of [
  "schema_migrations",
  "tickets",
  "audit_events",
  "remote_support_sessions",
  "security_events",
  "users",
  "tenants",
]) {
  assert.match(sql, new RegExp(`create table ${table}\\b`, "i"), `Missing SQL table ${table}`);
}

for (const requiredSql of [
  "insert into schema_migrations (id, applied_at)",
  "'001-initial-schema'",
  "tenant_id text not null default 'tenant-nexera-pilot'",
  "source text not null check (source in ('rustdesk-consent', 'auth', 'glpi', 'admin'))",
  "create index idx_tickets_tenant_id",
  "create index idx_users_tenant_id",
]) {
  assert.ok(sql.includes(requiredSql), `Missing SQL fragment: ${requiredSql}`);
}

for (const requiredSchema of [
  "export const schemaMigrations",
  "tenantId: text(\"tenant_id\")",
  "export const users",
  "export const tenants",
  "\"admin\"",
]) {
  assert.ok(drizzleSchema.includes(requiredSchema), `Missing Drizzle fragment: ${requiredSchema}`);
}

for (const forbiddenDemoFragment of ["NX-1042", "NX-1041", "NX-1039", "usr-demo", "ana-demo", "exec-demo"]) {
  assert.ok(!baselineSeed.includes(forbiddenDemoFragment), `Baseline seed must not include demo fragment: ${forbiddenDemoFragment}`);
}

for (const requiredBaselineFragment of ["tenant-nexera-pilot", "admin-demo", "demo_data_allowed", "  0,"]) {
  assert.ok(baselineSeed.includes(requiredBaselineFragment), `Missing baseline seed fragment: ${requiredBaselineFragment}`);
}

for (const requiredDemoFragment of ["NX-1042", "NX-1041", "NX-1039", "usr-demo", "ana-demo", "exec-demo"]) {
  assert.ok(demoSeed.includes(requiredDemoFragment), `Missing demo seed fragment: ${requiredDemoFragment}`);
}

console.log("D1 migration manifest and Drizzle schema are aligned.");
