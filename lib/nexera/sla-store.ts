import { env } from "cloudflare:workers";
import type { SlaConfig } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

const defaults: SlaConfig = { responseMinutes: 60, resolutionMinutes: 480, businessStart: "09:00", businessEnd: "18:00", timezone: "America/Santiago" };
const memory = globalThis as typeof globalThis & { nexeraSla?: Record<string, SlaConfig> };

export async function getSlaConfig(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (env.DB) {
      await env.DB.prepare("create table if not exists sla_configs (tenant_id text primary key, response_minutes integer not null, resolution_minutes integer not null, business_start text not null, business_end text not null, timezone text not null)").run();
      const row = await env.DB.prepare("select * from sla_configs where tenant_id = ?").bind(tenantId).first<{ response_minutes: number; resolution_minutes: number; business_start: string; business_end: string; timezone: string }>();
      if (row) return { responseMinutes: row.response_minutes, resolutionMinutes: row.resolution_minutes, businessStart: row.business_start, businessEnd: row.business_end, timezone: row.timezone };
    }
  } catch { /* Use memory fallback. */ }
  return memory.nexeraSla?.[tenantId] ?? defaults;
}

export async function updateSlaConfig(input: SlaConfig, tenantId = DEFAULT_TENANT_ID) {
  if (!Number.isInteger(input.responseMinutes) || input.responseMinutes < 1 || !Number.isInteger(input.resolutionMinutes) || input.resolutionMinutes < input.responseMinutes) throw new Error("Los tiempos SLA no son válidos");
  try {
    if (env.DB) {
      await env.DB.prepare("create table if not exists sla_configs (tenant_id text primary key, response_minutes integer not null, resolution_minutes integer not null, business_start text not null, business_end text not null, timezone text not null)").run();
      await env.DB.prepare("insert into sla_configs (tenant_id, response_minutes, resolution_minutes, business_start, business_end, timezone) values (?, ?, ?, ?, ?, ?) on conflict(tenant_id) do update set response_minutes=excluded.response_minutes, resolution_minutes=excluded.resolution_minutes, business_start=excluded.business_start, business_end=excluded.business_end, timezone=excluded.timezone").bind(tenantId, input.responseMinutes, input.resolutionMinutes, input.businessStart, input.businessEnd, input.timezone).run();
      return input;
    }
  } catch { /* Use memory fallback. */ }
  memory.nexeraSla ??= {};
  memory.nexeraSla[tenantId] = input;
  return input;
}
