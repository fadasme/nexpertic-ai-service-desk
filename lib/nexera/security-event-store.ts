import { env } from "cloudflare:workers";
import type { CreateSecurityEventInput, SecurityEvent } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type StoreShape = {
  events: SecurityEvent[];
};

type SecurityEventRow = {
  tenant_id?: string | null;
  id: string;
  action: string;
  at: string;
  detail: string;
  fingerprint?: string | null;
  severity: SecurityEvent["severity"];
  source: SecurityEvent["source"];
  ticket_id?: string | null;
  acknowledged_at?: string | null;
};

const globalStore = globalThis as typeof globalThis & {
  nexeraSecurityEventStore?: StoreShape;
};

function getStore() {
  if (!globalStore.nexeraSecurityEventStore) {
    globalStore.nexeraSecurityEventStore = { events: [] };
  }

  return globalStore.nexeraSecurityEventStore;
}

function mapRow(row: SecurityEventRow): SecurityEvent {
  return {
    tenantId: row.tenant_id ?? DEFAULT_TENANT_ID,
    action: row.action,
    at: row.at,
    detail: row.detail,
    fingerprint: row.fingerprint ?? undefined,
    id: row.id,
    severity: row.severity,
    source: row.source,
    ticketId: row.ticket_id ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined,
  };
}

async function ensureSecuritySchema(db: D1Database) {
  await db
    .prepare("create table if not exists security_events (id text primary key, tenant_id text not null default 'tenant-nexera-pilot', action text not null, at text not null, detail text not null, fingerprint text, severity text not null, source text not null, ticket_id text)")
    .run();
  await db
    .prepare("alter table security_events add column tenant_id text not null default 'tenant-nexera-pilot'")
    .run()
    .catch(() => undefined);
  await db.prepare("alter table security_events add column acknowledged_at text").run().catch(() => undefined);
}

export async function createSecurityEvent(input: CreateSecurityEventInput) {
  const event: SecurityEvent = {
    ...input,
    tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
    at: new Date().toISOString(),
    id: `sec-${Date.now()}-${crypto.randomUUID()}`,
  };

  const db = env.DB;

  if (!db) {
    getStore().events = [event, ...getStore().events];
    return event;
  }

  try {
    await ensureSecuritySchema(db);
    await db
      .prepare("insert into security_events (id, tenant_id, action, at, detail, fingerprint, severity, source, ticket_id, acknowledged_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(event.id, event.tenantId ?? DEFAULT_TENANT_ID, event.action, event.at, event.detail, event.fingerprint ?? null, event.severity, event.source, event.ticketId ?? null, null)
      .run();
    return event;
  } catch {
    getStore().events = [event, ...getStore().events];
    return event;
  }
}

export async function acknowledgeSecurityEvent(id: string, tenantId = DEFAULT_TENANT_ID) {
  const acknowledgedAt = new Date().toISOString();
  const db = env.DB;
  if (db) {
    try { await ensureSecuritySchema(db); const result = await db.prepare("update security_events set acknowledged_at = ? where id = ? and tenant_id = ?").bind(acknowledgedAt, id, tenantId).run(); return result.meta.changes ? acknowledgedAt : null; } catch { /* Fall through to memory. */ }
  }
  const event = getStore().events.find((item) => item.id === id && (item.tenantId ?? DEFAULT_TENANT_ID) === tenantId);
  if (!event) return null;
  event.acknowledgedAt = acknowledgedAt;
  return acknowledgedAt;
}

export async function listSecurityEvents(source?: SecurityEvent["source"], tenantId = DEFAULT_TENANT_ID) {
  const db = env.DB;

  if (!db) {
    return getStore().events.filter((event) => {
      const matchesSource = !source || event.source === source;
      const matchesTenant = (event.tenantId ?? DEFAULT_TENANT_ID) === tenantId;
      return matchesSource && matchesTenant;
    });
  }

  try {
    await ensureSecuritySchema(db);
    const rows = source
      ? await db.prepare("select * from security_events where tenant_id = ? and source = ? order by at desc").bind(tenantId, source).all<SecurityEventRow>()
      : await db.prepare("select * from security_events where tenant_id = ? order by at desc").bind(tenantId).all<SecurityEventRow>();

    return rows.results.map(mapRow);
  } catch {
    return getStore().events.filter((event) => {
      const matchesSource = !source || event.source === source;
      const matchesTenant = (event.tenantId ?? DEFAULT_TENANT_ID) === tenantId;
      return matchesSource && matchesTenant;
    });
  }
}
