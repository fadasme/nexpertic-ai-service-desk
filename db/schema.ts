import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaMigrations = sqliteTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  externalRef: text("external_ref").notNull(),
  title: text("title").notNull(),
  requester: text("requester").notNull(),
  priority: text("priority", { enum: ["Critica", "Alta", "Media"] }).notNull(),
  status: text("status", {
    enum: ["Nuevo", "Asignado", "En diagnostico", "Pendiente usuario", "Escalado", "Resuelto"],
  }).notNull(),
  owner: text("owner").notNull(),
  category: text("category").notNull(),
  confidence: integer("confidence").notNull(),
  aiSummary: text("ai_summary").notNull(),
  sla: text("sla", { enum: ["Critico", "En riesgo", "Normal"] }).notNull(),
  source: text("source", { enum: ["chat", "portal", "email", "api"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id),
  actor: text("actor", { enum: ["Usuario", "Agente IA", "Analista", "GLPI Adapter", "RustDesk"] }).notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  at: text("at").notNull(),
});

export const remoteSupportSessions = sqliteTable("remote_support_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => tickets.id),
  provider: text("provider", { enum: ["RustDesk"] }).notNull(),
  code: text("code").notNull(),
  status: text("status", { enum: ["Esperando consentimiento", "Invitacion enviada", "Conectado"] }).notNull(),
  expiresInMinutes: integer("expires_in_minutes").notNull(),
  launchUrl: text("launch_url").notNull(),
  createdAt: text("created_at").notNull(),
  consentExpiresAt: text("consent_expires_at"),
  consentGrantedAt: text("consent_granted_at"),
  consentRejectedAt: text("consent_rejected_at"),
  consentToken: text("consent_token"),
});

export const securityEvents = sqliteTable("security_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  action: text("action").notNull(),
  at: text("at").notNull(),
  detail: text("detail").notNull(),
  fingerprint: text("fingerprint"),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull(),
  source: text("source", { enum: ["rustdesk-consent", "auth", "glpi", "admin"] }).notNull(),
  ticketId: text("ticket_id"),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["Usuario", "Analista", "Ejecutivo", "Admin"] }).notNull(),
  tenant: text("tenant").notNull(),
  status: text("status", { enum: ["Activo", "Invitado", "Suspendido"] }).notNull(),
  lastAccessAt: text("last_access_at"),
});

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status", { enum: ["Activo", "Piloto", "Suspendido"] }).notNull(),
  region: text("region").notNull(),
  glpiEnabled: integer("glpi_enabled").notNull(),
  oidcEnabled: integer("oidc_enabled").notNull(),
  rustdeskEnabled: integer("rustdesk_enabled").notNull(),
  demoDataAllowed: integer("demo_data_allowed").notNull(),
  requireRemoteConsent: integer("require_remote_consent").notNull(),
  requireSso: integer("require_sso").notNull(),
  createdAt: text("created_at").notNull(),
});
