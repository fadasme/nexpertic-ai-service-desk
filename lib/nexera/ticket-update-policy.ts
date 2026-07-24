import type { TicketPriority, TicketStatus, UpdateTicketInput } from "./contracts";

const allowedStatuses: TicketStatus[] = ["Nuevo", "Asignado", "En diagnostico", "Pendiente usuario", "Escalado", "Resuelto"];
const allowedPriorities: TicketPriority[] = ["Critica", "Alta", "Media"];

export function sanitizeTicketUpdate(input: Record<string, unknown>): UpdateTicketInput {
  const update: UpdateTicketInput = {};

  if (typeof input.externalRef === "string" && input.externalRef.trim()) {
    update.externalRef = input.externalRef.trim();
  }

  if (typeof input.owner === "string" && input.owner.trim()) {
    update.owner = input.owner.trim();
  }

  if (allowedStatuses.includes(input.status as TicketStatus)) {
    update.status = input.status as TicketStatus;
  }

  if (allowedPriorities.includes(input.priority as TicketPriority)) {
    update.priority = input.priority as TicketPriority;
  }

  return update;
}

export function hasTicketUpdate(input: UpdateTicketInput) {
  return Boolean(input.externalRef || input.owner || input.priority || input.status);
}
