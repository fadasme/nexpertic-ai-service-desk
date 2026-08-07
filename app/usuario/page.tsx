import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/nexera/auth-store";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { verifySessionCookie, sessionCookieName, sessionLockCookieName, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listKnowledgeArticles } from "@/lib/nexera/service";
import { listRemoteSupportSessions } from "@/lib/nexera/remote-support-store";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { KnowledgeSearchPanel } from "../KnowledgeSearchPanel";
import { ServiceDeskConsole } from "../ServiceDeskConsole";
import { SessionExpiryTicker } from "../SessionExpiryTicker";

export default async function UsuarioPage() {
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);
  const authMode = getAuthMode();

  if (sessionLock) {
    redirect("/signin?returnTo=/usuario&mode=unlock");
  }

  if (authMode === "production" && !signedSession) {
    redirect("/signin?returnTo=/usuario");
  }

  const session = signedSession ?? getSession("Usuario");
  const tenantId = DEFAULT_TENANT_ID;
  const tickets = await listStoredTickets({ tenantId });
  const auditEvents = await listAuditEvents(undefined, tenantId);
  const remoteSessions = await listRemoteSupportSessions(undefined, tenantId);
  const knowledge = listKnowledgeArticles();

  return (
    <main className="rolePageShell">
      <section className="roleLanding">
        <div>
          <p className="eyebrow">Portal usuario</p>
          <h2>Crear y seguir tus solicitudes</h2>
          <p>Esta vista prioriza la apertura de casos, el seguimiento y el conocimiento sugerido para autoservicio.</p>
        </div>
        <div className="roleLandingActions">
          <span className="badge">Rol {session.role}</span>
          <SessionExpiryTicker className="warning" expiresAt={session.expiresAt} />
          <a className="buttonLike primary" href="/signin?returnTo=/usuario">
            Cambiar sesion
          </a>
        </div>
        <SessionExpiryTicker mode="banner" expiresAt={session.expiresAt} />
      </section>
      <SessionExpiryTicker mode="modal" expiresAt={session.expiresAt} />

      <div className="rolePageGrid">
        <ServiceDeskConsole initialAuditEvents={auditEvents} initialKnowledgeArticles={knowledge} initialRemoteSessions={remoteSessions} initialSession={session} initialTickets={tickets} />
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Autoservicio</p>
              <h2>Conocimiento sugerido</h2>
            </div>
          </div>
          <KnowledgeSearchPanel initialArticles={knowledge} />
        </article>
      </div>
    </main>
  );
}
