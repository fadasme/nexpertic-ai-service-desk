import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export const journal = JSON.parse(readFileSync(new URL('drizzle/meta/_journal.json', root), 'utf8'));
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
export function referenceDatabase() {
  const db = new DatabaseSync(':memory:');
  for (const entry of journal.entries) db.exec(readFileSync(new URL(`drizzle/${entry.tag}.sql`, root), 'utf8'));
  return db;
}
export function migrationPlan(db) {
  const reference = referenceDatabase();
  const plan = [];
  try {
    const tables = reference.prepare("SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    for (const table of tables) {
      const existing = db.prepare('SELECT sql FROM sqlite_schema WHERE type=? AND name=?').get('table', table.name);
      if (!existing) { plan.push(table.sql); continue; }
      const current = db.prepare(`PRAGMA table_info(${quote(table.name)})`).all();
      for (const column of reference.prepare(`PRAGMA table_info(${quote(table.name)})`).all()) {
        const found = current.find((item) => item.name === column.name);
        if (found) {
          // Legacy SQLite TEXT PRIMARY KEY allowed a nullable declaration.
          if (found.type.toLowerCase() !== column.type.toLowerCase() || found.pk !== column.pk || (column.notnull && !found.notnull && !column.pk)) {
            throw new Error(`Incompatible column ${table.name}.${column.name}; manual migration required`);
          }
          continue;
        }
        if (column.pk) throw new Error(`Cannot add missing primary key ${table.name}.${column.name}`);
        plan.push(`ALTER TABLE ${quote(table.name)} ADD COLUMN ${quote(column.name)} ${column.type}${column.notnull ? ' NOT NULL' : ''}${column.dflt_value !== null ? ` DEFAULT ${column.dflt_value}` : ''}`);
      }
    }
    for (const index of reference.prepare("SELECT name, tbl_name, sql FROM sqlite_schema WHERE type='index' AND sql IS NOT NULL").all()) {
      const existing = db.prepare("SELECT tbl_name FROM sqlite_schema WHERE type='index' AND name=?").get(index.name);
      if (!existing) plan.push(index.sql);
      else {
        const columns = (conn) => conn.prepare(`PRAGMA index_info(${quote(index.name)})`).all().map((row) => row.name).join(',');
        const unique = (conn) => conn.prepare(`PRAGMA index_list(${quote(index.tbl_name)})`).all().find((row) => row.name === index.name)?.unique;
        if (existing.tbl_name !== index.tbl_name || columns(db) !== columns(reference) || unique(db) !== unique(reference)) throw new Error(`Incompatible index ${index.name}`);
      }
    }
    return plan;
  } finally { reference.close(); }
}
export function applyMigrations(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const sql of migrationPlan(db)) db.exec(sql);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key validation failed');
    for (const entry of journal.entries) db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').run(entry.tag, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path || path.startsWith('--')) throw new Error('Usage: node scripts/migrate-sqlite.mjs <sqlite-file> [--execute]. Stop the app before applying.');
  const execute = process.argv.includes('--execute');
  const db = new DatabaseSync(path, { readOnly: !execute });
  try {
    const plan = migrationPlan(db);
    console.log(plan.length ? plan.join(';\n') + ';' : 'Schema is current.');
    if (execute) {
      const backupPath = `${path}.backup-${Date.now()}`;
      db.prepare('VACUUM INTO ?').run(backupPath);
      applyMigrations(db);
      console.log(`Migration applied; backup: ${backupPath}`);
    } else console.log('Dry run only.');
  } finally { db.close(); }
}
