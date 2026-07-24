import type { TenantConfig } from "@/lib/nexera/contracts";

type TenantConfigPanelProps = {
  tenants: TenantConfig[];
};

export function TenantConfigPanel({ tenants }: TenantConfigPanelProps) {
  return (
    <div className="tenantPanel">
      <div className="ticketTopline">
        <strong>Tenants y configuracion</strong>
        <span className="badge">{tenants.length} cliente(s)</span>
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
              <span>RustDesk {tenant.features.rustdesk ? "on" : "off"}</span>
            </div>
            <div className="permissionList">
              <span>Consentimiento remoto {tenant.policies.requireRemoteConsent ? "requerido" : "opcional"}</span>
              <span>SSO {tenant.policies.requireSso ? "requerido" : "opcional"}</span>
              <span>Demo data {tenant.policies.demoDataAllowed ? "permitida" : "bloqueada"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
