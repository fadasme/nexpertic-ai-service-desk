import { cookies } from "next/headers";
import { getSession } from "@/lib/nexera/auth-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { verifySessionCookie, sessionCookieName, sessionLockCookieName, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { listUserAccounts } from "@/lib/nexera/user-store";
import { AuthReturnLink } from "./AuthReturnLink";
import { SessionExpiryTicker } from "./SessionExpiryTicker";

function roleRoute(role: string) {
  if (role === "Usuario") return { href: "/usuario", label: "Portal usuario" };
  if (role === "Analista") return { href: "/analista", label: "Consola analista" };
  if (role === "Ejecutivo") return { href: "/ejecutivo", label: "Panel ejecutivo" };
  return { href: "/admin", label: "Centro de gobierno" };
}

export default async function Home() {
  const tenantId = DEFAULT_TENANT_ID;
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);
  const authMode = getAuthMode();
  const session = signedSession ?? getSession("Usuario");
  const tickets = await listStoredTickets({ tenantId });
  const users = await listUserAccounts(tenantId);
  const securityEvents = await listSecurityEvents(undefined, tenantId);
  const authLocked = Boolean(sessionLock) || (authMode === "production" && !signedSession);
  const route = roleRoute(session.role);
  const alertCount = securityEvents.filter((event) => event.severity !== "info").length;
  const openTickets = tickets.filter((ticket) => ticket.status !== "Resuelto").length;
  if (authLocked) {
    return (
      <main className="authLockShell">
        <section className="authLockCard">
          <p className="eyebrow">Acceso protegido</p>
          <h1>Nexpertic AI Service Desk</h1>
          <p>
            Esta instancia está bloqueada o requiere una sesión segura. Abre la pantalla de acceso para volver a
            entrar con usuario y clave.
          </p>
          <div className="authLockActions">
            <AuthReturnLink className="buttonLike primary">Abrir pantalla de acceso</AuthReturnLink>
            <form action="/api/auth/logout" method="post">
              <button type="submit">Limpiar sesion</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nexera-shell">
      <aside className="sidebar" aria-label="Navegacion Nexpertic">
        <div className="brand">
          <img className="brandLogo" src="/nexpertic-logo-white.png" alt="Nexpertic AI Service Desk" />
        </div>
        <div className="sidebarBadge">
          <span>Versión piloto</span>
          <strong>{authMode === "demo" ? "Acceso controlado" : "Producción controlada"}</strong>
        </div>
        <div className="sidebarBadge">
          <span>Rol activo</span>
          <strong>{session.role}</strong>
        </div>
        <div className="sidebarStatus">
          <div>
            <span>Tickets abiertos</span>
            <strong>{openTickets}</strong>
          </div>
          <div>
            <span>Alertas</span>
            <strong>{alertCount}</strong>
          </div>
          <p>La portada enruta a cada experiencia por rol sin mezclar gobierno, operación y narrativa ejecutiva.</p>
        </div>
        <nav className="navList">
          <a className="active" href={route.href}>
            Ir a {route.label}
          </a>
          <a href="/usuario">Usuario</a>
          <a href="/analista">Analista</a>
          <a href="/ejecutivo">Ejecutivo</a>
          <a href="/admin">Admin</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Portada de la plataforma</p>
            <h1>Nexpertic AI Service Desk</h1>
            <p className="topbarLead">Una entrada neutra para elegir el espacio correcto: autoservicio, operación, dirección o gobierno.</p>
          </div>
          <div className="topbarRight">
            <div className="topbarStats" aria-label="Resumen del producto">
              <span><strong>{tickets.length}</strong> tickets</span>
              <span><strong>{users.length}</strong> usuarios</span>
              <span><strong>{alertCount}</strong> alertas</span>
              <SessionExpiryTicker expiresAt={session.expiresAt} />
            </div>
          <div className="topbarActions">
            <a className="buttonLike" href="/signin">Iniciar sesión</a>
            <a className="buttonLike primary" href={route.href}>Continuar como {session.role}</a>
          </div>
          <SessionExpiryTicker mode="banner" expiresAt={session.expiresAt} />
        </div>
      </header>
      <SessionExpiryTicker mode="modal" expiresAt={session.expiresAt} />

        <section className="roleLanding">
          <div>
            <p className="eyebrow">Nexpertic AI Service Desk</p>
            <h2>Soporte, gobierno y automatización en una sola plataforma</h2>
            <p>
              Una entrada clara para elegir tu experiencia por rol, avanzar al trabajo correcto y mantener trazabilidad
              de cada acción.
            </p>
          </div>
          <div className="roleLandingActions">
            <a className="buttonLike primary" href={route.href}>
              Ir a {route.label}
            </a>
          </div>
        </section>

        <section className="homeValueGrid" aria-label="Propuesta de valor">
          <article className="homeValueCard">
            <span className="eyebrow">1. Operación</span>
            <h3>Tickets, soporte remoto y escalamiento guiado</h3>
            <p>Centraliza solicitudes, prioriza incidencias y coordina resolución con contexto real.</p>
          </article>
          <article className="homeValueCard">
            <span className="eyebrow">2. Gobierno</span>
            <h3>Usuarios, tenants, secretos y auditoría</h3>
            <p>Controla acceso, postura de riesgo y cumplimiento con vistas dedicadas para administración.</p>
          </article>
          <article className="homeValueCard">
            <span className="eyebrow">3. Dirección</span>
            <h3>Lectura ejecutiva para avanzar el piloto</h3>
            <p>Observa completitud, SLA, riesgos y roadmap sin mezclar señal operativa con narrativa comercial.</p>
          </article>
        </section>

        <section className="homeHeroPanel">
          <div>
            <p className="eyebrow">Arranque rápido</p>
            <h2>Entra por el rol correcto y continúa donde corresponde</h2>
            <p>
              La plataforma ya está separada por experiencia: usuario, analista, ejecutivo y admin. Cada una abre su
              propia superficie de trabajo.
            </p>
            <SessionExpiryTicker mode="banner" expiresAt={session.expiresAt} />
          </div>
        </section>

        <section className="grid">
          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Usuario</p>
                <h2>Autoservicio y tickets</h2>
              </div>
            </div>
            <p className="permissionHint">Crear y seguir solicitudes, con sugerencias de conocimiento y flujo asistido.</p>
            <a className="buttonLike primary" href="/usuario">Abrir portal usuario</a>
          </article>

          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Analista</p>
                <h2>Operación y soporte</h2>
              </div>
            </div>
            <p className="permissionHint">Resolver, clasificar, consultar APIs y operar soporte remoto con trazabilidad.</p>
            <a className="buttonLike primary" href="/analista">Abrir consola analista</a>
          </article>

          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Ejecutivo</p>
                <h2>Dirección y métricas</h2>
              </div>
            </div>
            <p className="permissionHint">Ver completitud, riesgo, narrativa y próximos hitos del piloto.</p>
            <a className="buttonLike primary" href="/ejecutivo">Abrir panel ejecutivo</a>
          </article>

          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Admin</p>
                <h2>Gobierno y control</h2>
              </div>
            </div>
            <p className="permissionHint">Gestionar usuarios, tenants, secretos y seguridad de plataforma.</p>
            <a className="buttonLike primary" href="/admin">Abrir centro de gobierno</a>
          </article>
        </section>
      </section>
    </main>
  );
}
