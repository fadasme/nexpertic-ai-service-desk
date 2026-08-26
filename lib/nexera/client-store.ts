import { env } from "cloudflare:workers";
import type { Client, CreateClientInput } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type ClientRow = { id: string; tenant_id: string; name: string; email: string; status: Client["status"]; created_at: string };

const memory = globalThis as typeof globalThis & { nexeraClients?: Client[] };

function getMemory() {
  memory.nexeraClients ??= [];
  return memory.nexeraClients;
}

function map(row: ClientRow): Client {
  return { id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, status: row.status, createdAt: row.created_at };
}

async function ensureTable() {
  if (!env.DB) return false;
  await env.DB.prepare("create table if not exists clients (id text primary key, tenant_id text not null, name text not null, email text not null, status text not null, created_at text not null, unique(tenant_id, email))").run();
  return true;
}

export async function listClients(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (await ensureTable()) {
      const rows = await env.DB.prepare("select * from clients where tenant_id = ? order by name").bind(tenantId).all<ClientRow>();
      return rows.results.map(map);
    }
  } catch {
    // Fall back to the local store when D1 is unavailable during development.
  }
  return getMemory().filter((client) => client.tenantId === tenantId);
}

export async function createClient(input: CreateClientInput, tenantId = DEFAULT_TENANT_ID) {
  const client: Client = { id: `client-${crypto.randomUUID()}`, tenantId, name: input.name.trim(), email: input.email.trim().toLowerCase(), status: "Activo", createdAt: new Date().toISOString() };
  if (!client.name || !client.email) throw new Error("name and email are required");
  try {
    if (await ensureTable()) {
      await env.DB.prepare("insert into clients (id, tenant_id, name, email, status, created_at) values (?, ?, ?, ?, ?, ?)").bind(client.id, client.tenantId, client.name, client.email, client.status, client.createdAt).run();
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
