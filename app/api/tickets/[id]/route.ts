import { getStoredTicket, updateStoredTicket } from "@/lib/nexera/ticket-store";
import { createAuditEvent } from "@/lib/nexera/audit-store";
import { requirePermission } from "@/lib/nexera/auth-store";
import { summarizeTicketChanges } from "@/lib/nexera/ticket-history";
import { hasTicketUpdate, sanitizeTicketUpdate } from "@/lib/nexera/ticket-update-policy";
import { isValidTicketTransition } from "@/lib/nexera/ticket-workflow";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const update = sanitizeTicketUpdate(body);
  if (!hasTicketUpdate(update)) {
    return Response.json({ error: "At least one valid ticket field is required" }, { status: 400 });
  }

  const requiredPermission = update.externalRef ? "ticket:sync-glpi" : "ticket:update";
  const authorization = await requirePermission(request, requiredPermission);
  if (!authorization.allowed) return authorization.response;

  const { id } = await context.params;
  const tenantId = await tenantIdFromRequest(request);
  const currentTicket = await getStoredTicket(id, tenantId);

  if (!currentTicket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (update.status && update.status !== currentTicket.status && !isValidTicketTransition(currentTicket.status, update.status)) {
    return Response.json(
      {
        error: `Transition ${currentTicket.status} -> ${update.status} is not allowed`,
      },
      { status: 409 },
    );
  }

  const ticket = await updateStoredTicket(id, update, tenantId);

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  await createAuditEvent({
    actor: authorization.session?.role === "Analista" || authorization.session?.role === "Admin" ? "Analista" : "Usuario",
    action: "Ticket actualizado",
    detail: summarizeTicketChanges(currentTicket, ticket),
    tenantId,
    ticketId: ticket.id,
  });

  return Response.json({ data: ticket });
}
