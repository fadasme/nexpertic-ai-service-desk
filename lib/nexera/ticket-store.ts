import { getTicketRepository } from "./repositories";
import type { CreateTicketInput, TicketPriority, UpdateTicketInput } from "./contracts";

export function listStoredTickets(filters?: { priority?: TicketPriority | "Todas"; q?: string; requester?: string; tenantId?: string }) {
  return getTicketRepository().list(filters);
}

export function getStoredTicket(id: string, tenantId?: string) {
  return getTicketRepository().get(id, tenantId);
}

export function createStoredTicket(input: CreateTicketInput) {
  return getTicketRepository().create(input);
}

export function updateStoredTicket(id: string, input: UpdateTicketInput, tenantId?: string) {
  return getTicketRepository().update(id, input, tenantId);
}
