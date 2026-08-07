import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExecutiveMetrics, getSlaSummary, listKnowledgeArticles } from "@/lib/nexera/service";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import { getSession } from "@/lib/nexera/auth-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { getPilotReadiness } from "@/lib/nexera/pilot-readiness";
import { listRemoteSupportSessions } from "@/lib/nexera/remote-support-store";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
import { getSecretPosture } from "@/lib/nexera/secret-posture";
import { verifySessionCookie, sessionCookieName, sessionLockCookieName, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { listUserAccounts } from "@/lib/nexera/user-store";
import { ApiProbe } from "../ApiProbe";
import { CommercialModel } from "../CommercialModel";
import { DeploymentArchitecture } from "../DeploymentArchitecture";
import { OperationsGuide } from "../OperationsGuide";
import { PilotCommandCenter } from "../PilotCommandCenter";
import { PilotHealthPanel } from "../PilotHealthPanel";
import { PilotLaunch } from "../PilotLaunch";
import { ProductRoadmap } from "../ProductRoadmap";
import { ProjectStatusPanel } from "../ProjectStatusPanel";
import { SecretPosturePanel } from "../SecretPosturePanel";
import { ServiceDeskConsole } from "../ServiceDeskConsole";
import { SessionExpiryTicker } from "../SessionExpiryTicker";

export default async function EjecutivoPage() {
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);
  const authMode = getAuthMode();

  if (sessionLock) {
    redirect("/signin?returnTo=/ejecutivo&mode=unlock");
  }

  if (authMode === "production" && !signedSession) {
    redirect("/signin?returnTo=/ejecutivo");
  }

  const session = signedSession ?? getSession("Ejecutivo");
  const tenantId = DEFAULT_TENANT_ID;
  const tickets = await listStoredTickets({ tenantId });
  const auditEvents = await listAuditEvents(undefined, tenantId);
  const remoteSessions = await listRemoteSupportSessions(undefined, tenantId);
  const users = await listUserAccounts(tenantId);
  const knowledge = listKnowledgeArticles();
  const executiveMetrics = getExecutiveMetrics();
  const pilotReadiness = getPilotReadiness();
  const secretPosture = getSecretPosture();
  const securityEvents = await listSecurityEvents(undefined, tenantId);
  const securitySummary = {
    critical: securityEvents.filter((event) => event.severity === "critical").length,
    info: securityEvents.filter((event) => event.severity === "info").length,
    warning: securityEvents.filter((event) => event.severity === "warning").length,
  };
  const slaSummary = getSlaSummary(tickets);
  const readiness = [
    { label: "Frontend Nexpertic", progress: 84, status: "Operativo" },
    { label: "API y D1", progress: 78, status: "Activo" },
    { label: "RBAC server-side", progress: 72, status: "Activo" },
    { label: "Soporte remoto", progress: 62, status: "Persistido" },
    { label: "GLPI real", progress: 38, status: "Pendiente" },
  ];

  return (
    <main className="rolePageShell">
      <section className="roleLanding">
        <div>
          <p className="eyebrow">Panel ejecutivo</p>
          <h2>Ver riesgo, completitud y próximos hitos</h2>
          <p>Esta vista concentra la lectura de salud, progreso y decisión para el piloto y la expansión comercial.</p>
        </div>
        <div className="roleLandingActions">
          <span className="badge">Rol {session.role}</span>
          <SessionExpiryTicker className="warning" expiresAt={session.expiresAt} />
          <a className="buttonLike primary" href="/signin?returnTo=/ejecutivo">
            Cambiar sesion
          </a>
        </div>
        <SessionExpiryTicker mode="banner" expiresAt={session.expiresAt} />
      </section>
      <SessionExpiryTicker mode="modal" expiresAt={session.expiresAt} />

      <div className="rolePageGrid">
        <PilotHealthPanel
          authMode={authMode}
          readiness={pilotReadiness}
          securityAlerts={securitySummary.warning + securitySummary.critical}
          secretPosture={secretPosture}
        />
        <OperationsGuide />
        <PilotCommandCenter
          authMode={authMode}
          readiness={pilotReadiness}
          securityAlerts={securitySummary.warning + securitySummary.critical}
          secretPosture={secretPosture}
        />

        <article className="panel span2" id="ejecutivo">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Portal ejecutivo</p>
              <h2>Estado del soporte</h2>
            </div>
          </div>
          <div className="executiveBand">
            {executiveMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
            <p>
              El foco de riesgo esta en accesos Microsoft 365 y conectividad VPN. Ambos casos son candidatos para automatizacion guiada en la siguiente iteracion.
            </p>
          </div>
          <div className="executiveSplit">
            <div>
              <h3>SLA por riesgo</h3>
              <div className="riskStack">
                {slaSummary.map((item) => (
                  <div className={`riskItem ${item.tone}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Readiness MVP</h3>
              <div className="readinessList">
                {readiness.map((item) => (
                  <div key={item.label}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.status}</strong>
                    </div>
                    <progress max="100" value={item.progress}>
                      {item.progress}%
                    </progress>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="panel span2">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Operación</p>
              <h2>Tickets y sesión activa</h2>
            </div>
          </div>
          <ServiceDeskConsole
            initialAuditEvents={auditEvents}
            initialKnowledgeArticles={knowledge}
            initialRemoteSessions={remoteSessions}
            initialSession={session}
            initialTickets={tickets}
          />
        </article>

        <article className="panel span2" id="estado-producto">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Narrativa de plataforma</p>
              <h2>Del estado actual al piloto</h2>
            </div>
            <span className="badge">Ruta ejecutiva</span>
          </div>
          <div className="homeNarrative">
            <ProjectStatusPanel readiness={pilotReadiness} />
            <PilotLaunch readiness={pilotReadiness} />
            <DeploymentArchitecture />
            <CommercialModel />
            <ProductRoadmap />
          </div>
        </article>

        <article className="panel span2" id="admin-ia">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Seguridad ejecutiva</p>
              <h2>Postura de secretos y trazabilidad</h2>
            </div>
          </div>
          <SecretPosturePanel posture={secretPosture} />
        </article>

        <article className="panel span2" id="api">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Backend operativo</p>
              <h2>APIs Nexpertic</h2>
            </div>
          </div>
          <ApiProbe />
        </article>
      </div>
    </main>
  );
}
