import { getAuditRepository } from "./repositories";
import type { CreateAuditEventInput } from "./contracts";

export function listAuditEvents(ticketId?: string, tenantId?: string) {
  return getAuditRepository().list(ticketId, tenantId);
}

export function createAuditEvent(input: CreateAuditEventInput) {
  return getAuditRepository().create(input);
}
