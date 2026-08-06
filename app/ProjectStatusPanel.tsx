import type { PilotReadiness } from "@/lib/nexera/contracts";

type ProjectStatusPanelProps = {
  readiness: PilotReadiness;
};

function toneForStatus(status: PilotReadiness["items"][number]["status"]) {
  if (status === "ready") return "ok";
  if (status === "warning") return "warning";
  return "danger";
}

function targetForItem(key: string) {
  switch (key) {
    case "auth-mode":
    case "session-secret":
    case "consent-secret":
    case "oidc-state-secret":
      return "#admin-ia";
    case "glpi":
    case "oidc":
      return "#api";
    case "demo-data":
      return "#estado-producto";
    default:
      return "#estado-producto";
  }
}

export function ProjectStatusPanel({ readiness }: ProjectStatusPanelProps) {
  const doneItems = readiness.items.filter((item) => item.status === "ready");
  const pendingItems = readiness.items.filter((item) => item.status !== "ready");
  const primaryPending = pendingItems[0];

  return (
    <article className="panel span2" id="estado-proyecto">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Estado actual</p>
          <h2>Completitud del piloto</h2>
        </div>
        <span className={`badge ${readiness.mode === "pilot_ready" ? "" : "warning"}`}>{readiness.score}% completado</span>
      </div>

      <div className="pilotSummary" aria-label="Resumen de estado del proyecto">
        <div className="ok">
          <span>Listo</span>
          <strong>{doneItems.length}</strong>
        </div>
        <div className="warning">
          <span>Faltan</span>
          <strong>{pendingItems.length}</strong>
        </div>
        <div className="danger">
          <span>Bloqueantes</span>
          <strong>{readiness.summary.blockers}</strong>
        </div>
        <p>{primaryPending ? primaryPending.detail : "No quedan bloqueantes funcionales visibles."}</p>
      </div>

      <div className="demoMeta">
        {primaryPending ? (
          <a className="buttonLike primary" href={primaryPending.key === "glpi" ? "#api" : primaryPending.key === "oidc" ? "#api" : "#admin-ia"}>
            Resolver siguiente pendiente
          </a>
        ) : (
          <a className="buttonLike primary" href="#api">
            Revisar APIs
          </a>
        )}
        <a className="buttonLike" href="#command-center">
          Volver a tickets
        </a>
        <a className="buttonLike" href="#admin-ia">
          Ver controles
        </a>
      </div>

      <div className="pilotGrid">
        <div>
          <h3>Listo</h3>
          <div className="readinessList">
            {doneItems.map((item) => (
              <div className="readinessItem ok" key={item.key}>
                <div>
                  <span>{item.label}</span>
                  <strong>Completado</strong>
                </div>
                <small>{item.owner} · {item.action}</small>
                <progress max="100" value={100}>100%</progress>
              </div>
            ))}
            {!doneItems.length ? <p className="emptyState">Aun no hay componentes completados.</p> : null}
          </div>
        </div>

        <div>
          <h3>Pendiente</h3>
          <div className="readinessList">
            {pendingItems.map((item) => (
              <a className={`readinessItem ${toneForStatus(item.status)}`} href={targetForItem(item.key)} key={item.key}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.status === "blocker" ? "Bloqueante" : "Pendiente"}</strong>
                </div>
                <small>{item.owner} · {item.action}</small>
                <progress max="100" value={item.status === "warning" ? 55 : 15}>{item.status}</progress>
              </a>
            ))}
            {!pendingItems.length ? <p className="emptyState">No quedan pendientes para la siguiente entrega.</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
