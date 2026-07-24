import type { SecretPosture } from "@/lib/nexera/contracts";

type SecretPosturePanelProps = {
  posture: SecretPosture;
};

export function SecretPosturePanel({ posture }: SecretPosturePanelProps) {
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
      <div className="secretGrid">
        {posture.items.map((item) => (
          <div className={`secretItem ${item.risk}`} key={item.key}>
            <strong>{item.label}</strong>
            <span>{item.configured ? "Configurado" : "Pendiente"}</span>
            <small>{item.devFallback ? "Usando fallback dev" : item.key}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
