import type { PilotReadiness } from "@/lib/nexera/contracts";

const exitCriteria = [
  "Crear ticket desde chat y sincronizarlo con GLPI real",
  "Ejecutar sesion RustDesk con consentimiento y auditoria",
  "Responder al menos 20 FAQs desde RAG validado",
  "Operar piloto con 3 roles: usuario, analista y ejecutivo",
  "Medir SLA, resolucion IA y trazabilidad por ticket",
];

type PilotLaunchProps = {
  readiness: PilotReadiness;
};

const statusLabel: Record<PilotReadiness["items"][number]["status"], string> = {
  blocker: "Bloqueante",
  ready: "Listo",
  warning: "Pendiente",
};

const statusTone: Record<PilotReadiness["items"][number]["status"], string> = {
  blocker: "danger",
  ready: "ok",
  warning: "warning",
};

function launchBadge(mode: PilotReadiness["mode"]) {
  if (mode === "pilot_ready") return "Listo piloto";
  if (mode === "demo_ready") return "Demo lista";
  return "Bloqueado";
}

function launchMessage(mode: PilotReadiness["mode"]) {
  if (mode === "pilot_ready") return "Sin bloqueantes. Instancia preparada para piloto controlado.";
  if (mode === "demo_ready") return "Flujo funcional para demo. Faltan cierres de configuracion productiva.";
  return "Aun no avanzar a cliente: hay bloqueantes de seguridad o integracion.";
}

export function PilotLaunch({ readiness }: PilotLaunchProps) {
  return (
    <article className="panel span2" id="pilot-launch">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Piloto enterprise</p>
          <h2>Launch pack 30 dias · {readiness.score}%</h2>
        </div>
        <span className={`badge ${readiness.mode === "pilot_ready" ? "" : "warning"}`}>{launchBadge(readiness.mode)}</span>
      </div>

      <div className="pilotSummary" aria-label="Resumen readiness piloto">
        <div className="ok">
          <span>Listos</span>
          <strong>{readiness.summary.ready}</strong>
        </div>
        <div className="warning">
          <span>Pendientes</span>
          <strong>{readiness.summary.warnings}</strong>
        </div>
        <div className="danger">
          <span>Bloqueantes</span>
          <strong>{readiness.summary.blockers}</strong>
        </div>
        <p>{launchMessage(readiness.mode)}</p>
      </div>

      <div className="pilotGrid">
        <div>
          <h3>Frentes de trabajo</h3>
          <div className="readinessList">
            {readiness.items.map((item) => (
              <div className={`readinessItem ${statusTone[item.status]}`} key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{statusLabel[item.status]}</strong>
                </div>
                <small>{item.owner} · {item.detail}</small>
                <progress max="100" value={item.status === "ready" ? 100 : item.status === "warning" ? 55 : 15}>{item.status}</progress>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Proximas acciones</h3>
          <ol className="exitList">
            {(readiness.nextActions.length ? readiness.nextActions : exitCriteria).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="pilotExitCard">
            <strong>Criterio de salida</strong>
            <p>`npm test` y `npm run e2e:local` deben pasar, sin datos demo ni secretos de desarrollo en ambiente cliente.</p>
          </div>
        </div>
      </div>
    </article>
  );
}
