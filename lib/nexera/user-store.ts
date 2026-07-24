import { getUserRepository } from "./repositories";
import type { UpdateUserRoleInput } from "./contracts";

export function listUserAccounts(tenantId?: string) {
  return getUserRepository().list(tenantId);
}

export async function getUserAccount(id: string) {
  const users = await listUserAccounts();
  return users.find((user) => user.id === id) ?? null;
}

export function updateUserRole(id: string, input: UpdateUserRoleInput, tenantId?: string) {
  return getUserRepository().updateRole(id, input, tenantId);
}
