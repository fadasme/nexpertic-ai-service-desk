import { getRemoteSupportRepository } from "./repositories";
import type { CreateRemoteSupportSessionInput, UpdateRemoteSupportSessionInput } from "./contracts";

export function listRemoteSupportSessions(ticketId?: string, tenantId?: string) {
  return getRemoteSupportRepository().list(ticketId, tenantId);
}

export function createStoredRemoteSupportSession(input: CreateRemoteSupportSessionInput) {
  return getRemoteSupportRepository().create(input);
}

export function updateStoredRemoteSupportSession(id: string, input: UpdateRemoteSupportSessionInput) {
  return getRemoteSupportRepository().update(id, input);
}
