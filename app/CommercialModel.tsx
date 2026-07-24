const editions = [
  {
    name: "Community",
    fit: "Adopcion inicial",
    features: ["Portal Nexpertic basico", "Tickets via GLPI Core", "Knowledge base simple", "Soporte comunitario"],
    metric: "Entrada",
  },
  {
    name: "Professional",
    fit: "Equipos TI medianos",
    features: ["Chat IA", "RAG validado", "Copiloto L2", "Dashboards operativos", "RustDesk OSS"],
    metric: "MVP vendible",
  },
  {
    name: "Enterprise",
    fit: "Clientes regulados",
    features: ["SSO/OIDC", "Auditoria avanzada", "RustDesk Server Pro", "On-Premise", "Politicas por tenant"],
    metric: "Mayor margen",
  },
];

const marketplaces = ["Agentes", "Prompts", "Integraciones", "Automatizaciones", "Runbooks"];

export function CommercialModel() {
  return (
    <article className="panel span2" id="modelo-comercial">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Modelo comercial</p>
          <h2>Ediciones y expansion</h2>
        </div>
        <span className="badge">SaaS + On-Prem</span>
      </div>

      <div className="editionGrid">
        {editions.map((edition) => (
          <div key={edition.name}>
            <div className="ticketTopline">
              <strong>{edition.name}</strong>
              <span className="badge">{edition.metric}</span>
            </div>
            <p>{edition.fit}</p>
            <ul>
              {edition.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="marketplaceBand">
        <strong>Marketplace futuro</strong>
        <div className="pillRow">
          {marketplaces.map((item) => (
            <span className="badge" key={item}>{item}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
