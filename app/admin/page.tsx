import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import { getSession } from "@/lib/nexera/auth-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { verifySessionCookie, sessionCookieName, sessionLockCookieName, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
import { getSecretPosture } from "@/lib/nexera/secret-posture";
import { listTenantConfigs } from "@/lib/nexera/tenant-store";
import { listUserAccounts } from "@/lib/nexera/user-store";
import { ApiProbe } from "../ApiProbe";
import { SecretPosturePanel } from "../SecretPosturePanel";
import { SecurityEventsPanel } from "../SecurityEventsPanel";
import { TenantConfigPanel } from "../TenantConfigPanel";
import { UserAdminPanel } from "../UserAdminPanel";
import { SessionExpiryTicker } from "../SessionExpiryTicker";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);
  const authMode = getAuthMode();

  if (sessionLock) {
    redirect("/signin?returnTo=/admin&mode=unlock");
  }

  if (authMode === "production" && !signedSession) {
    redirect("/signin?returnTo=/admin");
  }

  const session = signedSession ?? getSession("Admin");
  const tenantId = DEFAULT_TENANT_ID;
  const users = await listUserAccounts(tenantId);
  const tenants = await listTenantConfigs(tenantId);
  const events = await listSecurityEvents(undefined, tenantId);
  const activeUsers = users.filter((user) => user.status === "Activo").length;
  const adminUsers = users.filter((user) => user.role === "Admin").length;
  const activeTenants = tenants.filter((tenant) => tenant.status === "Activo").length;
  const summary = {
    critical: events.filter((event) => event.severity === "critical").length,
    info: events.filter((event) => event.severity === "info").length,
    warning: events.filter((event) => event.severity === "warning").length,
  };
  const secretPosture = getSecretPosture();
  const secretConfigured = secretPosture.summary.configured;
  const secretWarnings = secretPosture.summary.warnings;
  const auditEvents = await listAuditEvents(undefined, tenantId);

  return (
    <main className="rolePageShell">
      <section className="roleLanding">
        <div>
          <p className="eyebrow">Centro de gobierno</p>
          <h2>Administrar acceso, tenants y controles</h2>
          <p>Esta vista concentra usuarios, políticas, postura de secretos y eventos para operar la plataforma con trazabilidad.</p>
        </div>
        <div className="roleLandingActions">
          <span className="badge warning">Rol {session.role}</span>
          <SessionExpiryTicker className="warning" expiresAt={session.expiresAt} />
          <a className="buttonLike primary" href="/signin?returnTo=/admin">
            Cambiar sesion
          </a>
        </div>
        <SessionExpiryTicker mode="banner" expiresAt={session.expiresAt} />
      </section>
      <SessionExpiryTicker mode="modal" expiresAt={session.expiresAt} />

      <div className="rolePageGrid">
        <article className="panel span2">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Resumen de gobierno</p>
              <h2>Estado general del control</h2>
            </div>
            <span className="badge warning">Visión admin</span>
          </div>
          <div className="pilotSummary" aria-label="Resumen de gobierno">
            <div className="ok">
              <span>Usuarios activos</span>
              <strong>{activeUsers}</strong>
            </div>
            <div className="warning">
              <span>Admins</span>
              <strong>{adminUsers}</strong>
            </div>
            <div className="ok">
              <span>Tenants activos</span>
              <strong>{activeTenants}</strong>
            </div>
            <p>
              La consola deja visibles los controles de acceso, postura de secretos y eventos para administrar la plataforma sin perder trazabilidad.
            </p>
          </div>
          <div className="roleLandingActions">
            <a className="buttonLike primary" href="#admin-ia">
              Ir a usuarios
            </a>
            <a className="buttonLike" href="#api">
              Validar APIs
            </a>
            <a className="buttonLike" href="#auditoria">
              Ver auditoría
            </a>
          </div>
        </article>

        <article className="panel span2" id="admin-ia">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Admin IA</p>
              <h2>Usuarios y permisos</h2>
            </div>
          </div>
          <UserAdminPanel initialUsers={users} />
        </article>

        <article className="panel span2">
          <TenantConfigPanel tenants={tenants} />
        </article>

        <article className="panel span2">
          <SecretPosturePanel posture={secretPosture} />
          <div className="panelSpacer" />
          <div className="securitySummary">
            <span>Configurados {secretConfigured}</span>
            <span>Warnings {secretWarnings}</span>
            <span>Critical {secretPosture.summary.critical}</span>
          </div>
        </article>

        <article className="panel span2">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Seguridad</p>
              <h2>Eventos recientes</h2>
            </div>
          </div>
          <SecurityEventsPanel events={events.slice(0, 8)} summary={summary} />
        </article>

        <article className="panel span2" id="api">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Backend operativo</p>
              <h2>APIs y auditoría</h2>
            </div>
          </div>
          <ApiProbe />
          <div className="panelSpacer" />
          <p className="permissionHint">La consola administrativa comparte el mismo backend operativo y deja visibles solo los controles de gobierno.</p>
        </article>

        <article className="panel span2" id="auditoria">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Auditoría</p>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <div className="readinessList">
            {auditEvents.slice(0, 6).map((event) => (
              <div className="readinessItem warning" key={event.id}>
                <div>
                  <span>{event.action}</span>
                  <strong>{event.actor}</strong>
                </div>
                <small>{event.detail}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
