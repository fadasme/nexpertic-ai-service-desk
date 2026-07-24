-- Nexpertic AI Service Desk pilot baseline.
-- Safe for a clean pilot database: creates the tenant and one admin user only.

insert into tenants (
  id,
  name,
  slug,
  status,
  region,
  glpi_enabled,
  oidc_enabled,
  rustdesk_enabled,
  demo_data_allowed,
  require_remote_consent,
  require_sso,
  created_at
) values (
  'tenant-nexera-pilot',
  'Nexpertic Pilot',
  'nexpertic-pilot',
  'Piloto',
  'CL',
  0,
  0,
  1,
  0,
  1,
  0,
  '2026-07-22T12:00:00.000Z'
) on conflict(id) do nothing;

insert into users (
  id,
  tenant_id,
  name,
  email,
  role,
  tenant,
  status,
  last_access_at
) values (
  'admin-demo',
  'tenant-nexera-pilot',
  'Admin Nexpertic',
  'admin@nexera.demo',
  'Admin',
  'Nexpertic',
  'Activo',
  '2026-07-22T12:00:00.000Z'
) on conflict(id) do nothing;
