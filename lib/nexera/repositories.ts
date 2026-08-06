import { env } from "cloudflare:workers";
import { permissionsByRole, usersByRole } from "./auth-store";
import { tickets as seedTickets } from "./demo-data";
import { persistenceSchemaStatusFromRows, type PersistenceSchemaStatus } from "./persistence-status";
import { shouldSeedDemoData } from "./runtime-config";
import { DEFAULT_TENANT_ID } from "./tenant-context";
import type { AuditEvent, CreateAuditEventInput, CreateRemoteSupportSessionInput, CreateTicketInput, RemoteSupportSession, TenantConfig, Ticket, TicketPriority, UpdateRemoteSupportSessionInput, UpdateTicketInput, UpdateUserRoleInput, UserAccount, UserRole } from "./contracts";

export type TicketFilters = {
  priority?: TicketPriority | "Todas";
  q?: string;
  requester?: string;
  tenantId?: string;
};

export type TicketRepository = {
  list(filters?: TicketFilters): Promise<Ticket[]>;
  get(id: string, tenantId?: string): Promise<Ticket | null>;
  create(input: CreateTicketInput): Promise<Ticket>;
  update(id: string, input: UpdateTicketInput, tenantId?: string): Promise<Ticket | null>;
};

export type AuditRepository = {
  list(ticketId?: string, tenantId?: string): Promise<AuditEvent[]>;
  create(input: CreateAuditEventInput): Promise<AuditEvent>;
};

export type RemoteSupportRepository = {
  list(ticketId?: string, tenantId?: string): Promise<RemoteSupportSession[]>;
  create(input: CreateRemoteSupportSessionInput): Promise<RemoteSupportSession>;
  update(id: string, input: UpdateRemoteSupportSessionInput): Promise<RemoteSupportSession | null>;
};

export type UserRepository = {
  list(tenantId?: string): Promise<UserAccount[]>;
  updateRole(id: string, input: UpdateUserRoleInput, tenantId?: string): Promise<UserAccount | null>;
};

export type TenantRepository = {
  list(tenantId?: string): Promise<TenantConfig[]>;
};

export type DemoCleanupResult = {
  auditEvents: number;
  remoteSupportSessions: number;
  tickets: number;
  users: number;
};

type StoreShape = {
  tickets: Ticket[];
  auditEvents: AuditEvent[];
  remoteSupportSessions: RemoteSupportSession[];
  tenants: TenantConfig[];
  users: UserAccount[];
};

const globalStore = globalThis as typeof globalThis & {
  nexeraRepositoryStore?: StoreShape;
};

function seedAuditEvents(): AuditEvent[] {
  return seedTickets.flatMap((ticket, index) => [
    {
      tenantId: ticket.tenantId ?? DEFAULT_TENANT_ID,
      id: `audit-${ticket.id}-01`,
      ticketId: ticket.id,
      actor: "Usuario",
      action: "Solicitud recibida",
      detail: `Canal ${ticket.source}. Solicitante: ${ticket.requester}.`,
      at: `09:${24 + index} CLT`,
    },
    {
      tenantId: ticket.tenantId ?? DEFAULT_TENANT_ID,
      id: `audit-${ticket.id}-02`,
      ticketId: ticket.id,
      actor: "Agente IA",
      action: "Clasificacion automatica",
      detail: `${ticket.category}, prioridad ${ticket.priority}, confianza ${ticket.confidence}%.`,
      at: `09:${25 + index} CLT`,
    },
    {
      tenantId: ticket.tenantId ?? DEFAULT_TENANT_ID,
      id: `audit-${ticket.id}-03`,
      ticketId: ticket.id,
      actor: "GLPI Adapter",
      action: "Referencia operacional",
      detail: `Vinculado a ${ticket.externalRef}.`,
      at: `09:${26 + index} CLT`,
    },
  ]);
}

function getStore() {
  if (!globalStore.nexeraRepositoryStore) {
    const seedDemo = shouldSeedDemoData();
    globalStore.nexeraRepositoryStore = {
      tickets: seedDemo ? seedTickets.map((ticket) => ({ tenantId: DEFAULT_TENANT_ID, ...ticket })) : [],
      auditEvents: seedDemo ? seedAuditEvents() : [],
      remoteSupportSessions: [],
      tenants: seedTenants(),
      users: seedUsers(),
    };
  }

  return globalStore.nexeraRepositoryStore;
}

function seedTenants(): TenantConfig[] {
  return [
    {
      id: "tenant-nexera-pilot",
      name: "Nexpertic Pilot",
      slug: "nexpertic-pilot",
      status: "Piloto",
      region: "CL",
      features: {
        glpi: Boolean(process.env.GLPI_BASE_URL && process.env.GLPI_APP_TOKEN && process.env.GLPI_USER_TOKEN),
        oidc: Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
        rustdesk: true,
      },
      policies: {
        demoDataAllowed: shouldSeedDemoData(),
        requireRemoteConsent: true,
        requireSso: Boolean(process.env.OIDC_ISSUER),
      },
      createdAt: "2026-07-23T00:00:00.000Z",
    },
  ];
}

function seedUsers(): UserAccount[] {
  const lastAccessByRole: Record<UserRole, string> = {
    Admin: "2026-07-23T13:10:00.000Z",
    Analista: "2026-07-23T12:42:00.000Z",
    Ejecutivo: "2026-07-22T20:30:00.000Z",
    Usuario: "2026-07-23T11:05:00.000Z",
  };

  const roles = shouldSeedDemoData() ? (["Usuario", "Analista", "Ejecutivo", "Admin"] as UserRole[]) : (["Admin"] as UserRole[]);

  return roles.map((role) => ({
    ...usersByRole[role],
    role,
    status: "Activo",
    lastAccessAt: lastAccessByRole[role],
    permissions: permissionsByRole[role],
  }));
}

type TicketRow = {
  tenant_id?: string | null;
  id: string;
  external_ref: string;
  title: string;
  requester: string;
  priority: TicketPriority;
  status: Ticket["status"];
  owner: string;
  category: string;
  confidence: number;
  ai_summary: string;
  sla: Ticket["sla"];
  source: Ticket["source"];
  created_at: string;
};

type AuditEventRow = {
  tenant_id?: string | null;
  id: string;
  ticket_id: string;
  actor: AuditEvent["actor"];
  action: string;
  detail: string;
  at: string;
};

type RemoteSupportSessionRow = {
  tenant_id?: string | null;
  id: string;
  ticket_id: string;
  provider: RemoteSupportSession["provider"];
  code: string;
  status: RemoteSupportSession["status"];
  expires_in_minutes: number;
  launch_url: string;
  created_at: string;
  consent_expires_at?: string | null;
  consent_granted_at?: string | null;
  consent_rejected_at?: string | null;
  consent_token?: string | null;
};

type UserAccountRow = {
  tenant_id?: string | null;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant: string;
  status: UserAccount["status"];
  last_access_at?: string | null;
};

type TenantConfigRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantConfig["status"];
  region: string;
  glpi_enabled: number;
  oidc_enabled: number;
  rustdesk_enabled: number;
  demo_data_allowed: number;
  require_remote_consent: number;
  require_sso: number;
  created_at: string;
};

function inferTicket(description: string, count: number, requester = "Usuario demo", source: Ticket["source"] = "chat", tenantId = DEFAULT_TENANT_ID): Ticket {
  const lower = description.toLowerCase();
  const isIdentity = lower.includes("365") || lower.includes("correo") || lower.includes("clave");
  const isVpn = lower.includes("vpn");
  const isEndpoint = lower.includes("notebook") || lower.includes("lento");
  const priority: TicketPriority = lower.includes("urgente") || lower.includes("caido") ? "Alta" : "Media";

  return {
    tenantId,
    id: `NX-${1043 + count}`,
    externalRef: "Pendiente GLPI",
    title: description.length > 62 ? `${description.slice(0, 62)}...` : description,
    requester,
    priority,
    status: "Nuevo",
    owner: "Mesa L1",
    category: isIdentity ? "Identidad" : isVpn ? "Conectividad" : isEndpoint ? "Endpoint" : "General",
    confidence: isIdentity || isVpn || isEndpoint ? 86 : 69,
    aiSummary: isIdentity
      ? "Revisar licencia, MFA y bloqueo condicional. Fuente sugerida: Microsoft 365."
      : isVpn
        ? "Validar perfil VPN, MFA y credenciales recientes. Fuente sugerida: VPN corporativa."
        : isEndpoint
          ? "Solicitar telemetria y revisar aplicaciones de inicio. Fuente sugerida: Notebook lento."
          : "Solicitud normalizada por agente recepcionista. Requiere enriquecimiento RAG.",
    sla: priority === "Alta" ? "En riesgo" : "Normal",
    source,
    createdAt: new Date().toISOString(),
  };
}

export const memoryTicketRepository: TicketRepository = {
  async get(id, tenantId = DEFAULT_TENANT_ID) {
    return getStore().tickets.find((ticket) => ticket.id === id && (ticket.tenantId ?? DEFAULT_TENANT_ID) === tenantId) ?? null;
  },
  async list(filters) {
    const query = filters?.q?.trim().toLowerCase();
    const requester = filters?.requester?.trim().toLowerCase();
    const tenantId = filters?.tenantId ?? DEFAULT_TENANT_ID;

    return getStore().tickets.filter((ticket) => {
      const matchesTenant = (ticket.tenantId ?? DEFAULT_TENANT_ID) === tenantId;
      const matchesPriority = !filters?.priority || filters.priority === "Todas" || ticket.priority === filters.priority;
      const matchesRequester = !requester || ticket.requester.trim().toLowerCase() === requester;
      const matchesQuery =
        !query ||
        [ticket.id, ticket.title, ticket.requester, ticket.status, ticket.owner, ticket.category]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesTenant && matchesPriority && matchesRequester && matchesQuery;
    });
  },
  async create(input) {
    const description = input.description.trim();
    if (!description) {
      throw new Error("description is required");
    }

    const store = getStore();
    const ticket = inferTicket(description, store.tickets.length, input.requester, input.source, input.tenantId);
    store.tickets = [ticket, ...store.tickets];
    return ticket;
  },
  async update(id, input, tenantId = DEFAULT_TENANT_ID) {
    const store = getStore();
    const index = store.tickets.findIndex((ticket) => ticket.id === id && (ticket.tenantId ?? DEFAULT_TENANT_ID) === tenantId);

    if (index === -1) return null;

    store.tickets[index] = {
      ...store.tickets[index],
      ...input,
    };

    return store.tickets[index];
  },
};

export const memoryAuditRepository: AuditRepository = {
  async list(ticketId, tenantId = DEFAULT_TENANT_ID) {
    const events = getStore().auditEvents;
    return events.filter((event) => {
      const matchesTicket = !ticketId || event.ticketId === ticketId;
      const matchesTenant = (event.tenantId ?? DEFAULT_TENANT_ID) === tenantId;
      return matchesTicket && matchesTenant;
    });
  },
  async create(input) {
    const event: AuditEvent = {
      ...input,
      tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
      id: `audit-${input.ticketId}-${Date.now()}`,
      at: new Date().toISOString(),
    };

    getStore().auditEvents = [event, ...getStore().auditEvents];
    return event;
  },
};

function createRemoteSupportSession(input: CreateRemoteSupportSessionInput): RemoteSupportSession {
  const consentToken = crypto.randomUUID();
  const createdAt = new Date();

  return {
    tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
    id: `rs-${input.ticketId}-${Date.now()}`,
    ticketId: input.ticketId,
    provider: "RustDesk",
    code: `RD-${Math.floor(100000 + Math.random() * 899999)}`,
    status: "Esperando consentimiento",
    expiresInMinutes: 15,
    launchUrl: `rustdesk://connect/${input.ticketId.toLowerCase()}`,
    createdAt: createdAt.toISOString(),
    consentExpiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString(),
    consentGrantedAt: undefined,
    consentRejectedAt: undefined,
    consentToken,
  };
}

export const memoryRemoteSupportRepository: RemoteSupportRepository = {
  async list(ticketId, tenantId = DEFAULT_TENANT_ID) {
    const sessions = getStore().remoteSupportSessions;
    return sessions.filter((session) => {
      const matchesTicket = !ticketId || session.ticketId === ticketId;
      const matchesTenant = (session.tenantId ?? DEFAULT_TENANT_ID) === tenantId;
      return matchesTicket && matchesTenant;
    });
  },
  async create(input) {
    const session = createRemoteSupportSession(input);
    getStore().remoteSupportSessions = [session, ...getStore().remoteSupportSessions];
    return session;
  },
  async update(id, input) {
    const store = getStore();
    const index = store.remoteSupportSessions.findIndex((session) => session.id === id);
    if (index === -1) return null;

    store.remoteSupportSessions[index] = {
      ...store.remoteSupportSessions[index],
      ...input,
    };

    return store.remoteSupportSessions[index];
  },
};

export const memoryUserRepository: UserRepository = {
  async list(tenantId) {
    const users = tenantId ? getStore().users.filter((user) => (user.tenantId ?? DEFAULT_TENANT_ID) === tenantId) : getStore().users;
    return users.map((user) => ({ ...user, permissions: [...user.permissions] }));
  },
  async updateRole(id, input, tenantId = DEFAULT_TENANT_ID) {
    const store = getStore();
    const index = store.users.findIndex((user) => user.id === id && (user.tenantId ?? DEFAULT_TENANT_ID) === tenantId);
    if (index === -1) return null;

    store.users[index] = {
      ...store.users[index],
      role: input.role,
      permissions: permissionsByRole[input.role],
    };

    return { ...store.users[index], permissions: [...store.users[index].permissions] };
  },
};

export const memoryTenantRepository: TenantRepository = {
  async list(tenantId) {
    const tenants = tenantId ? getStore().tenants.filter((tenant) => tenant.id === tenantId) : getStore().tenants;
    return tenants.map((tenant) => ({ ...tenant, features: { ...tenant.features }, policies: { ...tenant.policies } }));
  },
};

export function cleanupMemoryDemoData(): DemoCleanupResult {
  const store = getStore();
  const demoTicketIds = new Set(seedTickets.map((ticket) => ticket.id));
  const demoUserIds = new Set(["usr-demo", "ana-demo", "exec-demo"]);
  const before = {
    auditEvents: store.auditEvents.length,
    remoteSupportSessions: store.remoteSupportSessions.length,
    tickets: store.tickets.length,
    users: store.users.length,
  };

  store.remoteSupportSessions = store.remoteSupportSessions.filter((session) => !demoTicketIds.has(session.ticketId));
  store.auditEvents = store.auditEvents.filter((event) => !demoTicketIds.has(event.ticketId));
  store.tickets = store.tickets.filter((ticket) => !demoTicketIds.has(ticket.id));
  store.users = store.users.filter((user) => !demoUserIds.has(user.id));

  if (!store.users.some((user) => user.role === "Admin")) {
    store.users = [...store.users, ...seedUsers().filter((user) => user.role === "Admin")];
  }

  return {
    auditEvents: before.auditEvents - store.auditEvents.length,
    remoteSupportSessions: before.remoteSupportSessions - store.remoteSupportSessions.length,
    tickets: before.tickets - store.tickets.length,
    users: before.users - store.users.length,
  };
}

function mapTicketRow(row: TicketRow): Ticket {
  return {
    tenantId: row.tenant_id ?? DEFAULT_TENANT_ID,
    id: row.id,
    externalRef: row.external_ref,
    title: row.title,
    requester: row.requester,
    priority: row.priority,
    status: row.status,
    owner: row.owner,
    category: row.category,
    confidence: row.confidence,
    aiSummary: row.ai_summary,
    sla: row.sla,
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return {
    tenantId: row.tenant_id ?? DEFAULT_TENANT_ID,
    id: row.id,
    ticketId: row.ticket_id,
    actor: row.actor,
    action: row.action,
    detail: row.detail,
    at: row.at,
  };
}

function mapRemoteSupportSessionRow(row: RemoteSupportSessionRow): RemoteSupportSession {
  return {
    tenantId: row.tenant_id ?? DEFAULT_TENANT_ID,
    id: row.id,
    ticketId: row.ticket_id,
    provider: row.provider,
    code: row.code,
    status: row.status,
    expiresInMinutes: row.expires_in_minutes,
    launchUrl: row.launch_url,
    createdAt: row.created_at,
    consentExpiresAt: row.consent_expires_at ?? new Date(new Date(row.created_at).getTime() + row.expires_in_minutes * 60 * 1000).toISOString(),
    consentGrantedAt: row.consent_granted_at ?? undefined,
    consentRejectedAt: row.consent_rejected_at ?? undefined,
    consentToken: row.consent_token ?? crypto.randomUUID(),
  };
}

function mapUserAccountRow(row: UserAccountRow): UserAccount {
  return {
    tenantId: row.tenant_id ?? DEFAULT_TENANT_ID,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tenant: row.tenant,
    status: row.status,
    lastAccessAt: row.last_access_at ?? undefined,
    permissions: permissionsByRole[row.role],
  };
}

function mapTenantConfigRow(row: TenantConfigRow): TenantConfig {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    region: row.region,
    features: {
      glpi: Boolean(row.glpi_enabled),
      oidc: Boolean(row.oidc_enabled),
      rustdesk: Boolean(row.rustdesk_enabled),
    },
    policies: {
      demoDataAllowed: Boolean(row.demo_data_allowed),
      requireRemoteConsent: Boolean(row.require_remote_consent),
      requireSso: Boolean(row.require_sso),
    },
    createdAt: row.created_at,
  };
}

async function ensureD1Schema(db: D1Database) {
  await db.batch([
    db.prepare("create table if not exists schema_migrations (id text primary key, applied_at text not null)"),
    db.prepare("create table if not exists tickets (id text primary key, tenant_id text not null default 'tenant-nexera-pilot', external_ref text not null, title text not null, requester text not null, priority text not null, status text not null, owner text not null, category text not null, confidence integer not null, ai_summary text not null, sla text not null, source text not null, created_at text not null)"),
    db.prepare("create table if not exists audit_events (id text primary key, tenant_id text not null default 'tenant-nexera-pilot', ticket_id text not null references tickets(id), actor text not null, action text not null, detail text not null, at text not null)"),
    db.prepare("create table if not exists remote_support_sessions (id text primary key, tenant_id text not null default 'tenant-nexera-pilot', ticket_id text not null references tickets(id), provider text not null, code text not null, status text not null, expires_in_minutes integer not null, launch_url text not null, created_at text not null, consent_expires_at text, consent_granted_at text, consent_rejected_at text, consent_token text)"),
    db.prepare("create table if not exists users (id text primary key, tenant_id text not null default 'tenant-nexera-pilot', name text not null, email text not null unique, role text not null, tenant text not null, status text not null, last_access_at text)"),
    db.prepare("create table if not exists tenants (id text primary key, name text not null, slug text not null unique, status text not null, region text not null, glpi_enabled integer not null, oidc_enabled integer not null, rustdesk_enabled integer not null, demo_data_allowed integer not null, require_remote_consent integer not null, require_sso integer not null, created_at text not null)"),
  ]);

  await db
    .prepare("insert into schema_migrations (id, applied_at) values ('001-initial-schema', '2026-07-23T00:00:00.000Z') on conflict(id) do nothing")
    .run()
    .catch(() => undefined);

  await db
    .prepare("alter table tickets add column tenant_id text not null default 'tenant-nexera-pilot'")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table audit_events add column tenant_id text not null default 'tenant-nexera-pilot'")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table remote_support_sessions add column tenant_id text not null default 'tenant-nexera-pilot'")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table users add column tenant_id text not null default 'tenant-nexera-pilot'")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table remote_support_sessions add column consent_expires_at text")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table remote_support_sessions add column consent_granted_at text")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table remote_support_sessions add column consent_rejected_at text")
    .run()
    .catch(() => undefined);
  await db
    .prepare("alter table remote_support_sessions add column consent_token text")
    .run()
    .catch(() => undefined);
}

async function seedD1IfEmpty(db: D1Database) {
  await ensureD1Schema(db);
  const seedDemo = shouldSeedDemoData();
  const count = await db.prepare("select count(*) as total from tickets").first<{ total: number }>();
  const tenantCount = await db.prepare("select count(*) as total from tenants").first<{ total: number }>();
  const userCount = await db.prepare("select count(*) as total from users").first<{ total: number }>();

  if ((tenantCount?.total ?? 0) === 0) {
    await db.batch(
      seedTenants().map((tenant) =>
        db
          .prepare("insert into tenants (id, name, slug, status, region, glpi_enabled, oidc_enabled, rustdesk_enabled, demo_data_allowed, require_remote_consent, require_sso, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(tenant.id, tenant.name, tenant.slug, tenant.status, tenant.region, Number(tenant.features.glpi), Number(tenant.features.oidc), Number(tenant.features.rustdesk), Number(tenant.policies.demoDataAllowed), Number(tenant.policies.requireRemoteConsent), Number(tenant.policies.requireSso), tenant.createdAt),
      ),
    );
  }

  if ((userCount?.total ?? 0) === 0) {
    await db.batch(
      seedUsers().map((user) =>
        db
          .prepare("insert into users (id, tenant_id, name, email, role, tenant, status, last_access_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(user.id, user.tenantId ?? DEFAULT_TENANT_ID, user.name, user.email, user.role, user.tenant, user.status, user.lastAccessAt ?? null),
      ),
    );
  }

  if (!seedDemo || (count?.total ?? 0) > 0) return;

  const auditEvents = seedAuditEvents();
  await db.batch([
    ...seedTickets.map((ticket) =>
      db
        .prepare("insert into tickets (id, tenant_id, external_ref, title, requester, priority, status, owner, category, confidence, ai_summary, sla, source, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(ticket.id, ticket.tenantId ?? DEFAULT_TENANT_ID, ticket.externalRef, ticket.title, ticket.requester, ticket.priority, ticket.status, ticket.owner, ticket.category, ticket.confidence, ticket.aiSummary, ticket.sla, ticket.source, ticket.createdAt),
    ),
    ...auditEvents.map((event) =>
      db
        .prepare("insert into audit_events (id, tenant_id, ticket_id, actor, action, detail, at) values (?, ?, ?, ?, ?, ?, ?)")
        .bind(event.id, event.tenantId ?? DEFAULT_TENANT_ID, event.ticketId, event.actor, event.action, event.detail, event.at),
    ),
  ]);
}

const d1TicketRepository: TicketRepository = {
  async list(filters) {
    const db = env.DB;
    if (!db) return memoryTicketRepository.list(filters);

    try {
      await seedD1IfEmpty(db);
      const query = filters?.q?.trim().toLowerCase();
      const priority = filters?.priority;
      const requester = filters?.requester?.trim().toLowerCase();
      const tenantId = filters?.tenantId ?? DEFAULT_TENANT_ID;
      const rows = await db
        .prepare("select * from tickets where tenant_id = ?1 and (?2 is null or priority = ?2) and (?3 is null or lower(id || ' ' || title || ' ' || requester || ' ' || status || ' ' || owner || ' ' || category) like ?3) and (?4 is null or lower(requester) = ?4) order by created_at desc")
        .bind(tenantId, !priority || priority === "Todas" ? null : priority, query ? `%${query}%` : null, requester ?? null)
        .all<TicketRow>();

      return rows.results.map(mapTicketRow);
    } catch {
      return memoryTicketRepository.list(filters);
    }
  },
  async get(id, tenantId = DEFAULT_TENANT_ID) {
    const db = env.DB;
    if (!db) return memoryTicketRepository.get(id, tenantId);

    try {
      await seedD1IfEmpty(db);
      const row = await db.prepare("select * from tickets where id = ? and tenant_id = ?").bind(id, tenantId).first<TicketRow>();
      return row ? mapTicketRow(row) : null;
    } catch {
      return memoryTicketRepository.get(id, tenantId);
    }
  },
  async create(input) {
    const db = env.DB;
    if (!db) return memoryTicketRepository.create(input);

    try {
      await seedD1IfEmpty(db);
      const current = await db.prepare("select count(*) as total from tickets").first<{ total: number }>();
      const ticket = inferTicket(input.description.trim(), current?.total ?? 0, input.requester, input.source, input.tenantId);
      await db
        .prepare("insert into tickets (id, tenant_id, external_ref, title, requester, priority, status, owner, category, confidence, ai_summary, sla, source, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(ticket.id, ticket.tenantId ?? DEFAULT_TENANT_ID, ticket.externalRef, ticket.title, ticket.requester, ticket.priority, ticket.status, ticket.owner, ticket.category, ticket.confidence, ticket.aiSummary, ticket.sla, ticket.source, ticket.createdAt)
        .run();

      return ticket;
    } catch {
      return memoryTicketRepository.create(input);
    }
  },
  async update(id, input, tenantId = DEFAULT_TENANT_ID) {
    const db = env.DB;
    if (!db) return memoryTicketRepository.update(id, input, tenantId);

    try {
      await seedD1IfEmpty(db);
      const existing = await db.prepare("select * from tickets where id = ? and tenant_id = ?").bind(id, tenantId).first<TicketRow>();
      if (!existing) return null;

      const ticket = {
        ...mapTicketRow(existing),
        ...input,
      };

      await db
        .prepare("update tickets set external_ref = ?, status = ?, owner = ?, priority = ? where id = ? and tenant_id = ?")
        .bind(ticket.externalRef, ticket.status, ticket.owner, ticket.priority, id, tenantId)
        .run();

      return ticket;
    } catch {
      return memoryTicketRepository.update(id, input, tenantId);
    }
  },
};

const d1AuditRepository: AuditRepository = {
  async list(ticketId, tenantId = DEFAULT_TENANT_ID) {
    const db = env.DB;
    if (!db) return memoryAuditRepository.list(ticketId);

    try {
      await seedD1IfEmpty(db);
      const rows = ticketId
        ? await db.prepare("select * from audit_events where tenant_id = ? and ticket_id = ? order by at desc").bind(tenantId, ticketId).all<AuditEventRow>()
        : await db.prepare("select * from audit_events where tenant_id = ? order by at desc").bind(tenantId).all<AuditEventRow>();

      return rows.results.map(mapAuditEventRow);
    } catch {
      return memoryAuditRepository.list(ticketId);
    }
  },
  async create(input) {
    const db = env.DB;
    if (!db) return memoryAuditRepository.create(input);

    try {
      await seedD1IfEmpty(db);
      const event: AuditEvent = {
        ...input,
        tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
        id: `audit-${input.ticketId}-${Date.now()}`,
        at: new Date().toISOString(),
      };

      await db
        .prepare("insert into audit_events (id, tenant_id, ticket_id, actor, action, detail, at) values (?, ?, ?, ?, ?, ?, ?)")
        .bind(event.id, event.tenantId ?? DEFAULT_TENANT_ID, event.ticketId, event.actor, event.action, event.detail, event.at)
        .run();

      return event;
    } catch {
      return memoryAuditRepository.create(input);
    }
  },
};

const d1RemoteSupportRepository: RemoteSupportRepository = {
  async list(ticketId, tenantId = DEFAULT_TENANT_ID) {
    const db = env.DB;
    if (!db) return memoryRemoteSupportRepository.list(ticketId);

    try {
      await seedD1IfEmpty(db);
      const rows = ticketId
        ? await db.prepare("select * from remote_support_sessions where tenant_id = ? and ticket_id = ? order by created_at desc").bind(tenantId, ticketId).all<RemoteSupportSessionRow>()
        : await db.prepare("select * from remote_support_sessions where tenant_id = ? order by created_at desc").bind(tenantId).all<RemoteSupportSessionRow>();

      return rows.results.map(mapRemoteSupportSessionRow);
    } catch {
      return memoryRemoteSupportRepository.list(ticketId);
    }
  },
  async create(input) {
    const db = env.DB;
    if (!db) return memoryRemoteSupportRepository.create(input);

    try {
      await seedD1IfEmpty(db);
      const session = createRemoteSupportSession(input);

      await db
        .prepare("insert into remote_support_sessions (id, tenant_id, ticket_id, provider, code, status, expires_in_minutes, launch_url, created_at, consent_expires_at, consent_granted_at, consent_rejected_at, consent_token) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(session.id, session.tenantId ?? DEFAULT_TENANT_ID, session.ticketId, session.provider, session.code, session.status, session.expiresInMinutes, session.launchUrl, session.createdAt, session.consentExpiresAt, session.consentGrantedAt ?? null, session.consentRejectedAt ?? null, session.consentToken)
        .run();

      return session;
    } catch {
      return memoryRemoteSupportRepository.create(input);
    }
  },
  async update(id, input) {
    const db = env.DB;
    if (!db) return memoryRemoteSupportRepository.update(id, input);

    try {
      await seedD1IfEmpty(db);
      const existing = await db.prepare("select * from remote_support_sessions where id = ?").bind(id).first<RemoteSupportSessionRow>();
      if (!existing) return null;

      const session = {
        ...mapRemoteSupportSessionRow(existing),
        ...input,
      };

      await db
        .prepare("update remote_support_sessions set status = ?, consent_granted_at = ?, consent_rejected_at = ? where id = ?")
        .bind(session.status, session.consentGrantedAt ?? null, session.consentRejectedAt ?? null, id)
        .run();

      return session;
    } catch {
      return memoryRemoteSupportRepository.update(id, input);
    }
  },
};

const d1UserRepository: UserRepository = {
  async list(tenantId) {
    const db = env.DB;
    if (!db) return memoryUserRepository.list(tenantId);

    try {
      await seedD1IfEmpty(db);
      const rows = tenantId
        ? await db.prepare("select * from users where tenant_id = ? order by role, name").bind(tenantId).all<UserAccountRow>()
        : await db.prepare("select * from users order by role, name").all<UserAccountRow>();
      return rows.results.map(mapUserAccountRow);
    } catch {
      return memoryUserRepository.list(tenantId);
    }
  },
  async updateRole(id, input, tenantId = DEFAULT_TENANT_ID) {
    const db = env.DB;
    if (!db) return memoryUserRepository.updateRole(id, input, tenantId);

    try {
      await seedD1IfEmpty(db);
      const existing = await db.prepare("select * from users where id = ? and tenant_id = ?").bind(id, tenantId).first<UserAccountRow>();
      if (!existing) return null;

      await db.prepare("update users set role = ? where id = ? and tenant_id = ?").bind(input.role, id, tenantId).run();
      return mapUserAccountRow({ ...existing, role: input.role });
    } catch {
      return memoryUserRepository.updateRole(id, input, tenantId);
    }
  },
};

const d1TenantRepository: TenantRepository = {
  async list(tenantId) {
    const db = env.DB;
    if (!db) return memoryTenantRepository.list(tenantId);

    try {
      await seedD1IfEmpty(db);
      const rows = tenantId
        ? await db.prepare("select * from tenants where id = ? order by name").bind(tenantId).all<TenantConfigRow>()
        : await db.prepare("select * from tenants order by name").all<TenantConfigRow>();
      return rows.results.map(mapTenantConfigRow);
    } catch {
      return memoryTenantRepository.list(tenantId);
    }
  },
};

export function getTicketRepository(): TicketRepository {
  return d1TicketRepository;
}

export function getAuditRepository(): AuditRepository {
  return d1AuditRepository;
}

export function getRemoteSupportRepository(): RemoteSupportRepository {
  return d1RemoteSupportRepository;
}

export function getUserRepository(): UserRepository {
  return d1UserRepository;
}

export function getTenantRepository(): TenantRepository {
  return d1TenantRepository;
}

export async function getPersistenceSchemaStatus(): Promise<PersistenceSchemaStatus> {
  const db = env.DB;
  if (!db) {
    return persistenceSchemaStatusFromRows([], true);
  }

  try {
    await ensureD1Schema(db);
    const rows = await db.prepare("select id from schema_migrations order by applied_at desc").all<{ id: string }>();
    return persistenceSchemaStatusFromRows(rows.results);
  } catch {
    return {
      appliedMigrations: [],
      schemaTracking: "missing",
    };
  }
}

export async function cleanupDemoData(): Promise<DemoCleanupResult> {
  const db = env.DB;
  if (!db) return cleanupMemoryDemoData();

  try {
    await seedD1IfEmpty(db);
    const demoTicketIds = seedTickets.map((ticket) => ticket.id);
    const demoUserIds = ["usr-demo", "ana-demo", "exec-demo"];
    const placeholders = demoTicketIds.map(() => "?").join(", ");
    const userPlaceholders = demoUserIds.map(() => "?").join(", ");

    const [remoteBefore, auditBefore, ticketBefore, userBefore] = await Promise.all([
      db.prepare(`select count(*) as total from remote_support_sessions where ticket_id in (${placeholders})`).bind(...demoTicketIds).first<{ total: number }>(),
      db.prepare(`select count(*) as total from audit_events where ticket_id in (${placeholders})`).bind(...demoTicketIds).first<{ total: number }>(),
      db.prepare(`select count(*) as total from tickets where id in (${placeholders})`).bind(...demoTicketIds).first<{ total: number }>(),
      db.prepare(`select count(*) as total from users where id in (${userPlaceholders})`).bind(...demoUserIds).first<{ total: number }>(),
    ]);

    await db.batch([
      db.prepare(`delete from remote_support_sessions where ticket_id in (${placeholders})`).bind(...demoTicketIds),
      db.prepare(`delete from audit_events where ticket_id in (${placeholders})`).bind(...demoTicketIds),
      db.prepare(`delete from tickets where id in (${placeholders})`).bind(...demoTicketIds),
      db.prepare(`delete from users where id in (${userPlaceholders})`).bind(...demoUserIds),
    ]);

    const admin = seedUsers().find((user) => user.role === "Admin");
    const adminCount = await db.prepare("select count(*) as total from users where role = 'Admin'").first<{ total: number }>();

    if (admin && (adminCount?.total ?? 0) === 0) {
      await db
        .prepare("insert into users (id, tenant_id, name, email, role, tenant, status, last_access_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(admin.id, admin.tenantId ?? DEFAULT_TENANT_ID, admin.name, admin.email, admin.role, admin.tenant, admin.status, admin.lastAccessAt ?? null)
        .run();
    }

    return {
      auditEvents: auditBefore?.total ?? 0,
      remoteSupportSessions: remoteBefore?.total ?? 0,
      tickets: ticketBefore?.total ?? 0,
      users: userBefore?.total ?? 0,
    };
  } catch {
    return cleanupMemoryDemoData();
  }
}
