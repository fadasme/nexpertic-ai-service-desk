import type { TenantConfig } from "@/lib/nexera/contracts";

type TenantConfigPanelProps = {
  tenants: TenantConfig[];
};

export function TenantConfigPanel({ tenants }: TenantConfigPanelProps) {
  const activeTenants = tenants.filter((tenant) => tenant.status === "Activo").length;
  const pilots = tenants.filter((tenant) => tenant.status === "Piloto").length;
  const withSso = tenants.filter((tenant) => tenant.policies.requireSso).length;
  const latestTenant = tenants[0] ?? null;

  return (
    <div className="tenantPanel">
      <div className="ticketTopline">
        <strong>Tenants y configuracion</strong>
        <span className="badge">{tenants.length} cliente(s)</span>
      </div>
      <div className="tenantExecutive">
        <div>
          <span>Activos</span>
          <strong>{activeTenants}</strong>
        </div>
        <div>
          <span>Pilotos</span>
          <strong>{pilots}</strong>
        </div>
        <div>
          <span>SSO requerido</span>
          <strong>{withSso}</strong>
        </div>
        <p>{latestTenant ? `${latestTenant.name} · ${latestTenant.region}` : "Sin tenants disponibles."}</p>
      </div>
      <div className="tenantGrid">
        {tenants.map((tenant) => (
          <div className="tenantCard" key={tenant.id}>
            <div className="ticketTopline">
              <strong>{tenant.name}</strong>
              <span className="badge">{tenant.status}</span>
            </div>
            <small>{tenant.slug} · region {tenant.region}</small>
            <div className="permissionList">
              <span>GLPI {tenant.features.glpi ? "on" : "off"}</span>
              <span>OIDC {tenant.features.oidc ? "on" : "off"}</span>
              <span>Soporte remoto {tenant.features.rustdesk ? "on" : "off"}</span>
            </div>
            <div className="permissionList">
              <span>Consentimiento remoto {tenant.policies.requireRemoteConsent ? "requerido" : "opcional"}</span>
              <span>SSO {tenant.policies.requireSso ? "requerido" : "opcional"}</span>
              <span>Datos de muestra {tenant.policies.demoDataAllowed ? "permitidos" : "bloqueados"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
