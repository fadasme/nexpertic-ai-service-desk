import { env } from "cloudflare:workers";
import type { CreateDeviceInput, Device, UpdateDeviceInput } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type DeviceRow = { id: string; tenant_id: string; name: string; client_name: string; status: Device["status"]; created_at: string };
const memory = globalThis as typeof globalThis & { nexeraDevices?: Device[] };

function getMemory() { memory.nexeraDevices ??= []; return memory.nexeraDevices; }
function map(row: DeviceRow): Device { return { id: row.id, tenantId: row.tenant_id, name: row.name, clientName: row.client_name, status: row.status, createdAt: row.created_at }; }

async function ensureTable() {
  if (!env.DB) return false;
  await env.DB.prepare("create table if not exists devices (id text primary key, tenant_id text not null, name text not null, client_name text not null, status text not null, created_at text not null)").run();
  return true;
}

export async function listDevices(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (await ensureTable()) {
      const rows = await env.DB.prepare("select * from devices where tenant_id = ? order by name").bind(tenantId).all<DeviceRow>();
      return rows.results.map(map);
    }
  } catch { /* Use memory fallback when D1 is unavailable. */ }
  return getMemory().filter((device) => device.tenantId === tenantId);
}

export async function createDevice(input: CreateDeviceInput, tenantId = DEFAULT_TENANT_ID) {
  const device: Device = { id: `device-${crypto.randomUUID()}`, tenantId, name: input.name.trim(), clientName: input.clientName.trim(), status: "Activo", createdAt: new Date().toISOString() };
  if (!device.name || !device.clientName) throw new Error("name and clientName are required");
  try {
    if (await ensureTable()) {
      await env.DB.prepare("insert into devices (id, tenant_id, name, client_name, status, created_at) values (?, ?, ?, ?, ?, ?)").bind(device.id, device.tenantId, device.name, device.clientName, device.status, device.createdAt).run();
      return device;
    }
  } catch { /* Fall through to the local store. */ }
  getMemory().push(device);
  return device;
}

export async function updateDevice(id: string, input: UpdateDeviceInput, tenantId = DEFAULT_TENANT_ID) {
  try {
    if (await ensureTable()) {
      const current = await env.DB.prepare("select * from devices where id = ? and tenant_id = ?").bind(id, tenantId).first<DeviceRow>();
      if (!current) return null;
      const next = { ...map(current), ...input };
      await env.DB.prepare("update devices set name = ?, client_name = ?, status = ? where id = ? and tenant_id = ?").bind(next.name, next.clientName, next.status, id, tenantId).run();
      return next;
    }
  } catch { /* Fall through to memory. */ }
  const store = getMemory();
  const index = store.findIndex((item) => item.id === id && item.tenantId === tenantId);
  if (index < 0) return null;
  store[index] = { ...store[index], ...input };
  return store[index];
}

export async function deleteDevice(id: string, tenantId = DEFAULT_TENANT_ID) {
  try {
    if (await ensureTable()) return Boolean((await env.DB.prepare("delete from devices where id = ? and tenant_id = ?").bind(id, tenantId).run()).meta.changes);
  } catch { /* Fall through to memory. */ }
  const store = getMemory();
  const before = store.length;
  memory.nexeraDevices = store.filter((item) => !(item.id === id && item.tenantId === tenantId));
  return memory.nexeraDevices.length < before;
}
