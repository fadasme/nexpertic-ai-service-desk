import { getTenantRepository } from "./repositories";
import type { UpdateTenantConfigInput } from "./contracts";

export function listTenantConfigs(tenantId?: string) {
  return getTenantRepository().list(tenantId);
}

export function updateTenantConfig(id: string, input: UpdateTenantConfigInput) {
  return getTenantRepository().update(id, input);
}
