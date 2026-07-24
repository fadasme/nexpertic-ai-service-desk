import { getTenantRepository } from "./repositories";

export function listTenantConfigs(tenantId?: string) {
  return getTenantRepository().list(tenantId);
}
