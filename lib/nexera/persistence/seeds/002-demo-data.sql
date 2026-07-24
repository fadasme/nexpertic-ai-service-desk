-- Nexpertic AI Service Desk demo data.
-- Use only for local demos or controlled sales environments.

insert into users (id, tenant_id, name, email, role, tenant, status, last_access_at) values
  ('usr-demo', 'tenant-nexera-pilot', 'Usuario Demo', 'usuario@nexera.demo', 'Usuario', 'Nexpertic', 'Activo', '2026-07-22T09:00:00.000Z'),
  ('ana-demo', 'tenant-nexera-pilot', 'Analista Demo', 'analista@nexera.demo', 'Analista', 'Nexpertic', 'Activo', '2026-07-22T09:05:00.000Z'),
  ('exec-demo', 'tenant-nexera-pilot', 'Ejecutivo Demo', 'ejecutivo@nexera.demo', 'Ejecutivo', 'Nexpertic', 'Activo', '2026-07-22T09:10:00.000Z')
on conflict(id) do nothing;

insert into tickets (
  id,
  tenant_id,
  external_ref,
  title,
  requester,
  priority,
  status,
  owner,
  category,
  confidence,
  ai_summary,
  sla,
  source,
  created_at
) values
  ('NX-1042', 'tenant-nexera-pilot', 'GLPI-88231', 'VPN no conecta despues de cambio de clave', 'Camila Torres', 'Alta', 'En diagnostico', 'Mesa L1', 'Conectividad', 87, 'Validar perfil VPN, MFA y cambio reciente de credenciales.', 'En riesgo', 'chat', '2026-07-22T09:24:00-04:00'),
  ('NX-1041', 'tenant-nexera-pilot', 'GLPI-88229', 'No puedo acceder a Microsoft 365', 'Javier Rojas', 'Critica', 'Nuevo', 'Sin asignar', 'Identidad', 91, 'Revisar licencia, bloqueo condicional y estado en Entra ID.', 'Critico', 'portal', '2026-07-22T08:51:00-04:00'),
  ('NX-1039', 'tenant-nexera-pilot', 'GLPI-88214', 'Notebook lento al iniciar jornada', 'Paula Mendez', 'Media', 'Pendiente usuario', 'Soporte endpoint', 'Endpoint', 78, 'Solicitar telemetria basica y revisar aplicaciones de inicio.', 'Normal', 'email', '2026-07-21T16:35:00-04:00')
on conflict(id) do nothing;

insert into audit_events (id, tenant_id, ticket_id, actor, action, detail, at) values
  ('audit-NX-1042-created', 'tenant-nexera-pilot', 'NX-1042', 'Agente IA', 'Ticket clasificado', 'Prioridad Alta detectada por cambio de credenciales y bloqueo VPN.', '09:24'),
  ('audit-NX-1042-assigned', 'tenant-nexera-pilot', 'NX-1042', 'Analista', 'Asignado a Mesa L1', 'Mesa L1 valida MFA, perfil VPN y ultimo cambio de password.', '09:29'),
  ('audit-NX-1041-created', 'tenant-nexera-pilot', 'NX-1041', 'Agente IA', 'Ticket clasificado', 'Incidente critico de identidad con posible impacto de productividad.', '08:51'),
  ('audit-NX-1039-created', 'tenant-nexera-pilot', 'NX-1039', 'Agente IA', 'Ticket clasificado', 'Endpoint lento, requiere telemetria y validacion con usuario.', '16:35')
on conflict(id) do nothing;
