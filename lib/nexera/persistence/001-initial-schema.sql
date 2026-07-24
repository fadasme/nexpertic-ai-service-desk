create table schema_migrations (
  id text primary key,
  applied_at text not null
);

insert into schema_migrations (id, applied_at)
values ('001-initial-schema', '2026-07-23T00:00:00.000Z')
on conflict(id) do nothing;

create table tickets (
  id text primary key,
  tenant_id text not null default 'tenant-nexera-pilot',
  external_ref text not null,
  title text not null,
  requester text not null,
  priority text not null check (priority in ('Critica', 'Alta', 'Media')),
  status text not null check (status in ('Nuevo', 'Asignado', 'En diagnostico', 'Pendiente usuario', 'Escalado', 'Resuelto')),
  owner text not null,
  category text not null,
  confidence integer not null,
  ai_summary text not null,
  sla text not null check (sla in ('Critico', 'En riesgo', 'Normal')),
  source text not null check (source in ('chat', 'portal', 'email', 'api')),
  created_at text not null
);

create table audit_events (
  id text primary key,
  tenant_id text not null default 'tenant-nexera-pilot',
  ticket_id text not null references tickets(id),
  actor text not null check (actor in ('Usuario', 'Agente IA', 'Analista', 'GLPI Adapter', 'RustDesk')),
  action text not null,
  detail text not null,
  at text not null
);

create table remote_support_sessions (
  id text primary key,
  tenant_id text not null default 'tenant-nexera-pilot',
  ticket_id text not null references tickets(id),
  provider text not null check (provider in ('RustDesk')),
  code text not null,
  status text not null check (status in ('Esperando consentimiento', 'Invitacion enviada', 'Conectado')),
  expires_in_minutes integer not null,
  launch_url text not null,
  created_at text not null,
  consent_expires_at text,
  consent_granted_at text,
  consent_rejected_at text,
  consent_token text
);

create index idx_tickets_priority on tickets(priority);
create index idx_tickets_status on tickets(status);
create index idx_tickets_tenant_id on tickets(tenant_id);
create index idx_audit_events_ticket_id on audit_events(ticket_id);
create index idx_audit_events_tenant_id on audit_events(tenant_id);
create index idx_remote_support_sessions_ticket_id on remote_support_sessions(ticket_id);
create index idx_remote_support_sessions_tenant_id on remote_support_sessions(tenant_id);

create table security_events (
  id text primary key,
  tenant_id text not null default 'tenant-nexera-pilot',
  action text not null,
  at text not null,
  detail text not null,
  fingerprint text,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  source text not null check (source in ('rustdesk-consent', 'auth', 'glpi', 'admin')),
  ticket_id text
);

create index idx_security_events_source on security_events(source);
create index idx_security_events_ticket_id on security_events(ticket_id);
create index idx_security_events_tenant_id on security_events(tenant_id);

create table users (
  id text primary key,
  tenant_id text not null default 'tenant-nexera-pilot',
  name text not null,
  email text not null unique,
  role text not null,
  tenant text not null,
  status text not null,
  last_access_at text
);

create index idx_users_tenant_id on users(tenant_id);

create table tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null check (status in ('Activo', 'Piloto', 'Suspendido')),
  region text not null,
  glpi_enabled integer not null,
  oidc_enabled integer not null,
  rustdesk_enabled integer not null,
  demo_data_allowed integer not null,
  require_remote_consent integer not null,
  require_sso integer not null,
  created_at text not null
);
