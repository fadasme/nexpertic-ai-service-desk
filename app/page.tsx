import {
  getExecutiveMetrics,
  getSlaSummary,
  listRemoteSupportConnectors,
  listAgents,
  listKnowledgeArticles,
} from "@/lib/nexera/service";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import { getSession } from "@/lib/nexera/auth-store";
import { listRemoteSupportSessions } from "@/lib/nexera/remote-support-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { getPilotReadiness } from "@/lib/nexera/pilot-readiness";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
import { getSecretPosture } from "@/lib/nexera/secret-posture";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listTenantConfigs } from "@/lib/nexera/tenant-store";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { listUserAccounts } from "@/lib/nexera/user-store";
import { AccessControlPanel } from "./AccessControlPanel";
import { ApiProbe } from "./ApiProbe";
import { CommercialModel } from "./CommercialModel";
import { DeploymentArchitecture } from "./DeploymentArchitecture";
import { OperationsGuide } from "./OperationsGuide";
import { KnowledgeSearchPanel } from "./KnowledgeSearchPanel";
import { PilotLaunch } from "./PilotLaunch";
import { ProductRoadmap } from "./ProductRoadmap";
import { SecurityEventsPanel } from "./SecurityEventsPanel";
import { ServiceDeskConsole } from "./ServiceDeskConsole";
import { SecretPosturePanel } from "./SecretPosturePanel";
import { TenantConfigPanel } from "./TenantConfigPanel";
import { UserAdminPanel } from "./UserAdminPanel";
import type { SecurityEvent, Ticket } from "@/lib/nexera/contracts";

function getOperationalMetrics(tickets: Ticket[], securityEvents: SecurityEvent[]) {
  const openTickets = tickets.filter((ticket) => ticket.status !== "Resuelto").length;
  const aiAverage = tickets.length ? Math.round(tickets.reduce((total, ticket) => total + ticket.confidence, 0) / tickets.length) : 0;
  const securityWarnings = securityEvents.filter((event) => event.severity !== "info").length;

  return [
    { label: "Tickets abiertos", value: String(openTickets), detail: "Persistidos en D1" },
    { label: "SLA cumplimiento", value: "94%", detail: "Objetivo enterprise 95%" },
    { label: "Eventos seguridad", value: String(securityWarnings), detail: "Warnings/Critical" },
    { label: "Confianza IA", value: `${aiAverage}%`, detail: "Promedio clasificacion" },
  ];
}

function getRuntimeReadiness() {
  return [
    { label: "Frontend Nexpertic", progress: 84, status: "Operativo" },
    { label: "API y D1", progress: 78, status: "Activo" },
    { label: "RBAC server-side", progress: 72, status: "Activo" },
    { label: "RustDesk", progress: 62, status: "Persistido" },
    { label: "GLPI real", progress: 38, status: "Pendiente" },
  ];
}

export default async function Home() {
  const tenantId = DEFAULT_TENANT_ID;
  const tickets = await listStoredTickets({ tenantId });
  const auditEvents = await listAuditEvents(undefined, tenantId);
  const remoteSessions = await listRemoteSupportSessions(undefined, tenantId);
  const users = await listUserAccounts(tenantId);
  const tenants = await listTenantConfigs(tenantId);
  const allSecurityEvents = await listSecurityEvents(undefined, tenantId);
  const secretPosture = getSecretPosture();
  const authMode = getAuthMode();
  const pilotReadiness = getPilotReadiness();
  const agents = listAgents();
  const knowledge = listKnowledgeArticles();
  const operationalMetrics = getOperationalMetrics(tickets, allSecurityEvents);
  const executiveMetrics = getExecutiveMetrics();
  const slaSummary = getSlaSummary(tickets);
  const readiness = getRuntimeReadiness();
  const remoteSupportConnectors = listRemoteSupportConnectors();
  const securityEvents = allSecurityEvents.slice(0, 5);
  const securitySummary = {
    critical: allSecurityEvents.filter((event) => event.severity === "critical").length,
    info: allSecurityEvents.filter((event) => event.severity === "info").length,
    warning: allSecurityEvents.filter((event) => event.severity === "warning").length,
  };
  const session = getSession("Usuario");

  return (
    <main className="nexera-shell">
      <aside className="sidebar" aria-label="Navegacion Nexpertic">
        <div className="brand">
          <img className="brandLogo" src="/nexpertic-logo-white.png" alt="Nexpertic AI Service Desk" />
        </div>

        <nav className="navList">
          {["Command Center", "Usuarios", "Analistas", "Conocimiento", "Ejecutivo", "Admin IA"].map((item, index) => (
            <a className={index === 0 ? "active" : ""} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              {item}
            </a>
          ))}
        </nav>

        <div className="coreCard">
          <span />
          <div>
            <strong>GLPI Core</strong>
            <p>Oculto tras adaptador Nexpertic</p>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operacion minima activa</p>
            <h1>Nexpertic AI Service Desk</h1>
          </div>
          <div className="topbarActions">
            <a className="buttonLike" href="#api">Ver APIs</a>
            <a className="buttonLike primary" href="#usuarios">Nuevo ticket</a>
          </div>
        </header>

        {authMode === "demo" ? (
          <section className="authModeBanner" aria-label="Modo de autorizacion">
            <div>
              <p className="eyebrow">Modo demo activo</p>
              <h2>Headers de prueba habilitados</h2>
              <p>Para piloto cliente usa `NEXERA_AUTH_MODE=production` y cookie firmada. Mientras tanto, esta instancia permite `x-nexera-role` para pruebas locales.</p>
            </div>
            <span>Auth: demo</span>
          </section>
        ) : null}

        <OperationsGuide />

        <AccessControlPanel initialSession={session} users={users} />

        <section className="metrics" aria-label="Metricas operativas">
          {operationalMetrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </section>

        <section className="grid">
          <ServiceDeskConsole initialAuditEvents={auditEvents} initialKnowledgeArticles={knowledge} initialRemoteSessions={remoteSessions} initialSession={session} initialTickets={tickets} />

          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">IA</p>
                <h2>Agentes activos</h2>
              </div>
            </div>
            <div className="agentList">
              {agents.map((agent) => (
                <div key={agent.id}>
                  <strong>{agent.name}</strong>
                  <p>{agent.goal}</p>
                  <span>{agent.score}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" id="conocimiento">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">RAG empresarial</p>
                <h2>Conocimiento validado</h2>
              </div>
            </div>
            <KnowledgeSearchPanel initialArticles={knowledge} />
          </article>

          <article className="panel span2" id="rustdesk">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Soporte remoto</p>
                <h2>Integracion RustDesk</h2>
              </div>
            </div>
            <div className="integrationGrid">
              {remoteSupportConnectors.map((connector) => (
                <div key={connector.id}>
                  <div className="ticketTopline">
                    <strong>{connector.mode}</strong>
                    <span className="badge">{connector.status}</span>
                  </div>
                  <p>{connector.launchPattern}</p>
                  <div className="pillRow">
                    {connector.capabilities.map((capability) => (
                      <span className="badge" key={capability}>{capability}</span>
                    ))}
                  </div>
                  <small>{connector.securityControls.join(" · ")}</small>
                </div>
              ))}
            </div>
          </article>

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
                      <progress max="100" value={item.progress}>{item.progress}%</progress>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="panel span2" id="admin-ia">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Admin IA</p>
                <h2>Politicas y controles</h2>
              </div>
            </div>
            <UserAdminPanel initialUsers={users} />
            <TenantConfigPanel tenants={tenants} />
            <SecretPosturePanel posture={secretPosture} />
            <div className="policyGrid">
              <div><strong>Agente</strong><strong>Accion permitida</strong><strong>Control</strong></div>
              <div><span>Nivel 1</span><span>Responder FAQs</span><span>Automatico</span></div>
              <div><span>Copiloto L2</span><span>Sugerir resolucion</span><span>Humano valida</span></div>
              <div><span>Automatizacion</span><span>Ejecutar runbook</span><span>Aprobacion requerida</span></div>
            </div>
            <SecurityEventsPanel events={securityEvents} summary={securitySummary} />
          </article>

          <PilotLaunch readiness={pilotReadiness} />

          <DeploymentArchitecture />

          <CommercialModel />

          <ProductRoadmap />

          <article className="panel span2" id="api">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Backend operativo</p>
                <h2>APIs Nexpertic</h2>
              </div>
            </div>
            <ApiProbe />
          </article>
        </section>
      </section>
    </main>
  );
}
