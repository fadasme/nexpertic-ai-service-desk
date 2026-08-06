import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/nexera/auth-store";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { verifySessionCookie, sessionCookieName } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listKnowledgeArticles } from "@/lib/nexera/service";
import { listRemoteSupportSessions } from "@/lib/nexera/remote-support-store";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { ApiProbe } from "../ApiProbe";
import { KnowledgeSearchPanel } from "../KnowledgeSearchPanel";
import { SecurityEventsPanel } from "../SecurityEventsPanel";
import { ServiceDeskConsole } from "../ServiceDeskConsole";

export default async function AnalistaPage() {
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const authMode = getAuthMode();

  if (authMode === "production" && !signedSession) {
    redirect("/signin?returnTo=/analista");
  }

  const session = signedSession ?? getSession("Analista");
  const tenantId = DEFAULT_TENANT_ID;
  const tickets = await listStoredTickets({ tenantId });
  const auditEvents = await listAuditEvents(undefined, tenantId);
  const remoteSessions = await listRemoteSupportSessions(undefined, tenantId);
  const knowledge = listKnowledgeArticles();
  const events = await listSecurityEvents(undefined, tenantId);
  const summary = {
    critical: events.filter((event) => event.severity === "critical").length,
    info: events.filter((event) => event.severity === "info").length,
    warning: events.filter((event) => event.severity === "warning").length,
  };

  return (
    <main className="rolePageShell">
      <section className="roleLanding">
        <div>
          <p className="eyebrow">Consola analista</p>
          <h2>Clasificar, resolver y escalar con contexto</h2>
          <p>Esta vista prioriza la operación de tickets, el conocimiento y el soporte remoto para la mesa L1/L2.</p>
        </div>
        <div className="roleLandingActions">
          <span className="badge">Rol {session.role}</span>
          <a className="buttonLike primary" href="/signin?returnTo=/analista">
            Cambiar sesion
          </a>
        </div>
      </section>

      <div className="rolePageGrid">
        <ServiceDeskConsole initialAuditEvents={auditEvents} initialKnowledgeArticles={knowledge} initialRemoteSessions={remoteSessions} initialSession={session} initialTickets={tickets} />
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">IA</p>
              <h2>Conocimiento y APIs</h2>
            </div>
          </div>
          <KnowledgeSearchPanel initialArticles={knowledge} />
          <div className="panelSpacer" />
          <ApiProbe />
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
      </div>
    </main>
  );
}
