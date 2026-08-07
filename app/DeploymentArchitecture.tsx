const layers = [
  ["Frontend Nexpertic", "Portal usuarios, analistas, ejecutivo y admin IA"],
  ["API Nexpertic", "Contratos propios, RBAC, auditoria y orquestacion"],
  ["Core GLPI", "Tickets, workflow, inventario y CMDB operacional"],
  ["IA / RAG", "Clasificacion, copiloto, conocimiento y trazabilidad"],
  ["Soporte remoto", "Soporte remoto con consentimiento y auditoria"],
];

const deploymentModes = [
  ["SaaS", "Nexpertic opera plataforma, actualizaciones, observabilidad y escalado."],
  ["On-Premise", "Cliente controla datos, GLPI, soporte remoto y modelos locales si aplica."],
  ["Hibrido", "IA o soporte remoto local con gestion SaaS y conectores controlados."],
];

export function DeploymentArchitecture() {
  return (
    <article className="panel span2" id="arquitectura">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Arquitectura</p>
          <h2>Despliegue SaaS / On-Prem</h2>
        </div>
        <span className="badge">Cloud agnostic</span>
      </div>

      <div className="architectureMap" aria-label="Mapa de arquitectura Nexpertic">
        {layers.map(([title, description], index) => (
          <div key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>

      <div className="deploymentModes">
        {deploymentModes.map(([mode, description]) => (
          <div key={mode}>
            <strong>{mode}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
