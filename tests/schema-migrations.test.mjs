import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { applyMigrations, migrationPlan, referenceDatabase } from '../scripts/migrate-sqlite.mjs';

test('all versioned migrations build 18 tables and applying twice is safe', () => {
  const db = referenceDatabase();
  assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type='table'").get().count, 18);
  applyMigrations(db);
  applyMigrations(db);
  assert.deepEqual(migrationPlan(db), []);
  db.close();
});
test('legacy dynamic tables retain data and gain custom fields', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE clients (id text primary key, tenant_id text not null, name text not null, email text not null, status text not null, created_at text not null, unique(tenant_id,email)); INSERT INTO clients VALUES ('c1','t1','Name','a@example.test','Activo','2026-09-09')");
  applyMigrations(db);
  assert.equal(db.prepare('SELECT name FROM clients').get().name, 'Name');
  assert.equal(db.prepare('SELECT custom_fields FROM clients').get().custom_fields, null);
  assert.deepEqual(migrationPlan(db), []);
  db.close();
});
test('incompatible legacy columns block migration without partial changes', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE clients (id INTEGER PRIMARY KEY)');
  assert.throws(() => applyMigrations(db), /Incompatible column/);
  assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type='table'").get().count, 1);
  db.close();
});
