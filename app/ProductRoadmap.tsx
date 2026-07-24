const roadmap = [
  {
    version: "V1",
    horizon: "0-90 dias",
    focus: "Service Desk IA",
    items: ["Chat", "Tickets", "RAG", "Agente L1", "Copiloto L2", "RustDesk", "Dashboard ejecutivo"],
  },
  {
    version: "V2",
    horizon: "3-6 meses",
    focus: "Operacion inteligente",
    items: ["Observabilidad", "Problem Management", "Change Management", "CMDB inteligente", "QA integrado", "DevOps"],
  },
  {
    version: "V3",
    horizon: "6-12 meses",
    focus: "AIOps y autonomia",
    items: ["Auto-remediacion", "Prediccion de incidentes", "Capacity Planning", "FinOps", "Analisis de impacto"],
  },
];

export function ProductRoadmap() {
  return (
    <article className="panel span2" id="roadmap">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>Evolucion del producto</h2>
        </div>
        <span className="badge">12 meses</span>
      </div>

      <div className="roadmapGrid">
        {roadmap.map((phase) => (
          <div key={phase.version}>
            <span className="roadmapVersion">{phase.version}</span>
            <strong>{phase.focus}</strong>
            <p>{phase.horizon}</p>
            <ul>
              {phase.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}
