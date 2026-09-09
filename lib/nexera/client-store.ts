import { env } from "cloudflare:workers";
import type { Client, CreateClientInput, UpdateClientInput } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type ClientRow = { id: string; tenant_id: string; name: string; email: string; status: Client["status"]; created_at: string; custom_fields?: string | null };

const memory = globalThis as typeof globalThis & { nexeraClients?: Client[] };

function getMemory() {
  memory.nexeraClients ??= [];
  return memory.nexeraClients;
}

function map(row: ClientRow): Client {
  return { id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, status: row.status, createdAt: row.created_at, customFields: row.custom_fields ? JSON.parse(row.custom_fields) as Record<string, string> : undefined };
}

function hasDatabase() { return Boolean(env.DB); }

export async function listClients(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (hasDatabase()) {
      const rows = await env.DB.prepare("select * from clients where tenant_id = ? order by name").bind(tenantId).all<ClientRow>();
      return rows.results.map(map);
    }
  } catch {
    // Fall back to the local store when D1 is unavailable during development.
  }
  return getMemory().filter((client) => client.tenantId === tenantId);
}

export async function createClient(input: CreateClientInput, tenantId = DEFAULT_TENANT_ID) {
  const client: Client = { id: `client-${crypto.randomUUID()}`, tenantId, name: input.name.trim(), email: input.email.trim().toLowerCase(), status: "Activo", createdAt: new Date().toISOString(), customFields: input.customFields };
  if (!client.name || !client.email) throw new Error("name and email are required");
  try {
    if (hasDatabase()) {
      await env.DB.prepare("insert into clients (id, tenant_id, name, email, status, created_at, custom_fields) values (?, ?, ?, ?, ?, ?, ?)").bind(client.id, client.tenantId, client.name, client.email, client.status, client.createdAt, client.customFields ? JSON.stringify(client.customFields) : null).run();
      return client;
    }
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new Error("A client with this email already exists");
  }
  const store = getMemory();
  if (store.some((item) => item.tenantId === tenantId && item.email === client.email)) throw new Error("A client with this email already exists");
  store.push(client);
  return client;
}

export async function updateClient(id: string, input: UpdateClientInput, tenantId = DEFAULT_TENANT_ID) {
  try {
    if (hasDatabase()) {
      const current = await env.DB.prepare("select * from clients where id = ? and tenant_id = ?").bind(id, tenantId).first<ClientRow>();
      if (!current) return null;
      const next = { ...map(current), ...input };
      await env.DB.prepare("update clients set name = ?, email = ?, status = ?, custom_fields = ? where id = ? and tenant_id = ?").bind(next.name, next.email, next.status, next.customFields ? JSON.stringify(next.customFields) : null, id, tenantId).run();
      return next;
    }
  } catch { /* Fall through to memory. */ }
  const store = getMemory();
  const index = store.findIndex((item) => item.id === id && item.tenantId === tenantId);
  if (index < 0) return null;
  store[index] = { ...store[index], ...input };
  return store[index];
}

export async function deleteClient(id: string, tenantId = DEFAULT_TENANT_ID) {
  try {
    if (hasDatabase()) return Boolean((await env.DB.prepare("delete from clients where id = ? and tenant_id = ?").bind(id, tenantId).run()).meta.changes);
  } catch { /* Fall through to memory. */ }
  const store = getMemory();
  const before = store.length;
  memory.nexeraClients = store.filter((item) => !(item.id === id && item.tenantId === tenantId));
  return memory.nexeraClients.length < before;
}
