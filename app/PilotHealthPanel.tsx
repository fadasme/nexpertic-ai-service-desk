import type { PilotReadiness, SecretPosture } from "@/lib/nexera/contracts";

type PilotHealthPanelProps = {
  authMode: string;
  readiness: PilotReadiness;
  securityAlerts: number;
  secretPosture: SecretPosture;
};

function healthTone(readiness: PilotReadiness, secretPosture: SecretPosture, securityAlerts: number) {
  if (readiness.mode === "pilot_ready" && secretPosture.mode === "ready" && securityAlerts === 0) return "ok";
  if (readiness.summary.blockers > 0 || secretPosture.summary.critical > 0) return "danger";
  return "warning";
}

export function PilotHealthPanel({ authMode, readiness, securityAlerts, secretPosture }: PilotHealthPanelProps) {
  const tone = healthTone(readiness, secretPosture, securityAlerts);
  const score = Math.round((readiness.score + secretPosture.summary.configured / secretPosture.summary.total * 100) / 2);
  const nextFocus = readiness.items.find((item) => item.status !== "ready") ?? null;
  const secretRisk = secretPosture.items.find((item) => item.risk !== "ok") ?? null;

  return (
    <article className="panel span2" id="salud-piloto">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Salud del piloto</p>
          <h2>Vista unificada de avance y riesgo</h2>
        </div>
        <span className={`badge ${tone === "ok" ? "" : tone === "danger" ? "danger" : "warning"}`}>{score}% salud</span>
      </div>

      <div className="healthSummary" aria-label="Resumen de salud del piloto">
        <div>
          <span>Auth</span>
          <strong>{authMode === "demo" ? "Controlado" : "Producción"}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{readiness.score}%</strong>
        </div>
        <div>
          <span>Secretos</span>
          <strong>{secretPosture.summary.configured}/{secretPosture.summary.total}</strong>
        </div>
        <div>
          <span>Alertas</span>
          <strong>{securityAlerts}</strong>
        </div>
        <p>
          {tone === "ok"
            ? "La plataforma ya opera con una base consistente para el piloto controlado."
            : nextFocus
              ? `Siguiente foco: ${nextFocus.label}.`
              : secretRisk
                ? `Revisar secreto: ${secretRisk.label}.`
                : "La plataforma requiere un cierre adicional antes de operar."}
        </p>
      </div>

      <div className="healthGrid">
        <div>
          <h3>Próximo foco</h3>
          <div className="healthCard">
            <strong>{nextFocus ? nextFocus.label : "Sin pendientes visibles"}</strong>
            <p>{nextFocus ? nextFocus.detail : "No quedan frentes operativos abiertos en la lectura actual."}</p>
          </div>
        </div>
        <div>
          <h3>Señal de riesgo</h3>
          <div className="healthCard">
            <strong>{secretRisk ? secretRisk.label : "Postura estable"}</strong>
            <p>{secretRisk ? `${secretRisk.configured ? "Configurado" : "Pendiente"} · ${secretRisk.key}` : "No hay riesgos críticos visibles en secretos."}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
