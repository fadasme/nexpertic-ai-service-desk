import type { SecretPosture } from "@/lib/nexera/contracts";

type SecretPosturePanelProps = {
  posture: SecretPosture;
};

export function SecretPosturePanel({ posture }: SecretPosturePanelProps) {
  const readyItems = posture.items.filter((item) => item.configured).length;
  const fallbackItems = posture.items.filter((item) => item.devFallback).length;
  const atRiskItems = posture.items.filter((item) => item.risk !== "ok").length;
  const latestRisk = posture.items.find((item) => item.risk !== "ok") ?? posture.items[0] ?? null;

  return (
    <div className="secretPosture">
      <div className="ticketTopline">
        <strong>Postura de secretos</strong>
        <span className={`badge ${posture.mode === "ready" ? "" : "warning"}`}>{posture.mode === "ready" ? "Lista" : "Revisar"}</span>
      </div>
      <div className="securitySummary">
        <span>{posture.summary.configured}/{posture.summary.total} configurados</span>
        <span>{posture.summary.warnings} warnings</span>
        <span>{posture.summary.critical} critical</span>
      </div>
      <div className="secretExecutive">
        <div>
          <span>Listos</span>
          <strong>{readyItems}</strong>
        </div>
        <div>
          <span>Fallback desarrollo</span>
          <strong>{fallbackItems}</strong>
        </div>
        <div>
          <span>En riesgo</span>
          <strong>{atRiskItems}</strong>
        </div>
        <p>{latestRisk ? `${latestRisk.label} · ${latestRisk.configured ? "Configurado" : "Pendiente"}` : "Sin postura de riesgo."}</p>
      </div>
      <div className="secretGrid">
        {posture.items.map((item) => (
          <div className={`secretItem ${item.risk}`} key={item.key}>
            <strong>{item.label}</strong>
            <span>{item.configured ? "Configurado" : "Pendiente"}</span>
            <small>{item.devFallback ? "Usando fallback de desarrollo" : item.key}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
