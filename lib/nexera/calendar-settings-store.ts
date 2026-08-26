import { env } from "cloudflare:workers";
import type { CalendarSettings } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

const defaults: CalendarSettings = { provider: "Microsoft 365", calendarId: "", timezone: "America/Santiago", syncEnabled: false };
type Row = { tenant_id: string; provider: CalendarSettings["provider"]; calendar_id: string; timezone: string; sync_enabled: number };
const memory = globalThis as typeof globalThis & { nexeraCalendarSettings?: Record<string, CalendarSettings> };
function map(row: Row): CalendarSettings { return { provider: row.provider, calendarId: row.calendar_id, timezone: row.timezone, syncEnabled: Boolean(row.sync_enabled) }; }
async function ensureTable() { if (!env.DB) return false; await env.DB.prepare("create table if not exists calendar_settings (tenant_id text primary key, provider text not null, calendar_id text not null, timezone text not null, sync_enabled integer not null)").run(); return true; }
export async function getCalendarSettings(tenantId = DEFAULT_TENANT_ID) { try { if (await ensureTable()) { const row = await env.DB.prepare("select * from calendar_settings where tenant_id = ?").bind(tenantId).first<Row>(); if (row) return map(row); } } catch { /* Use memory fallback when D1 is unavailable. */ } return memory.nexeraCalendarSettings?.[tenantId] ?? defaults; }
export async function updateCalendarSettings(input: CalendarSettings, tenantId = DEFAULT_TENANT_ID) { try { if (await ensureTable()) { await env.DB.prepare("insert into calendar_settings (tenant_id, provider, calendar_id, timezone, sync_enabled) values (?, ?, ?, ?, ?) on conflict(tenant_id) do update set provider=excluded.provider, calendar_id=excluded.calendar_id, timezone=excluded.timezone, sync_enabled=excluded.sync_enabled").bind(tenantId, input.provider, input.calendarId, input.timezone, input.syncEnabled ? 1 : 0).run(); return input; } } catch { /* Fall through to the local store. */ } memory.nexeraCalendarSettings ??= {}; memory.nexeraCalendarSettings[tenantId] = input; return input; }
