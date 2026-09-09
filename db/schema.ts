import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schemaMigrations = sqliteTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant-nexera-pilot"),
  customFields: text("custom_fields"),
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
  acknowledgedAt: text("acknowledged_at"),
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

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  customFields: text("custom_fields"),
}, (table) => [
  index("idx_assets_tenant_id").on(table.tenantId),
]);

export const calendarSettings = sqliteTable("calendar_settings", {
  tenantId: text("tenant_id").primaryKey(),
  provider: text("provider").notNull(),
  calendarId: text("calendar_id").notNull(),
  timezone: text("timezone").notNull(),
  syncEnabled: integer("sync_enabled").notNull(),
});

export const ticketTemplates = sqliteTable("ticket_templates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_ticket_templates_tenant_id").on(table.tenantId),
]);

export const automationRules = sqliteTable("automation_rules", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  matchText: text("match_text").notNull(),
  action: text("action").notNull(),
  enabled: integer("enabled").notNull(),
}, (table) => [
  index("idx_automation_rules_tenant_id").on(table.tenantId),
]);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_devices_tenant_id").on(table.tenantId),
]);

export const knowledgeArticles = sqliteTable("knowledge_articles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  qualityScore: integer("quality_score").notNull(),
  uses: integer("uses").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
}, (table) => [
  index("idx_knowledge_articles_tenant_id").on(table.tenantId),
]);

export const ticketSettings = sqliteTable("ticket_settings", {
  tenantId: text("tenant_id").primaryKey(),
  defaultPriority: text("default_priority").notNull(),
  defaultOwner: text("default_owner").notNull(),
  autoAssign: integer("auto_assign").notNull(),
  allowRequesterReply: integer("allow_requester_reply").notNull(),
});

export const slaConfigs = sqliteTable("sla_configs", {
  tenantId: text("tenant_id").primaryKey(),
  responseMinutes: integer("response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
  businessStart: text("business_start").notNull(),
  businessEnd: text("business_end").notNull(),
  timezone: text("timezone").notNull(),
});

export const customFields = sqliteTable("custom_fields", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  appliesTo: text("applies_to").notNull(),
  type: text("type").notNull(),
  required: integer("required").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_custom_fields_tenant_id").on(table.tenantId),
]);

export const technicianGroups = sqliteTable("technician_groups", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_technician_groups_tenant_id").on(table.tenantId),
]);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  customFields: text("custom_fields"),
}, (table) => [
  uniqueIndex("clients_tenant_email_unique").on(table.tenantId, table.email),
  index("idx_clients_tenant_id").on(table.tenantId),
]);
