import { requirePermission } from "@/lib/nexera/auth-store";
import { pullTicketFromGlpi, syncTicketWithGlpi } from "@/lib/nexera/glpi-adapter";
import { createAuditEvent } from "@/lib/nexera/audit-store";
import { listStoredTickets, updateStoredTicket } from "@/lib/nexera/ticket-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "ticket:sync-glpi");
  if (!authorization.allowed) return authorization.response;

  const body = await request.json().catch(() => ({}));
  const ticketId = typeof body.ticketId === "string" ? body.ticketId : "";
  const tenantId = await tenantIdFromRequest(request);
  const ticket = (await listStoredTickets({ tenantId })).find((item) => item.id === ticketId);

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  const direction = body.direction === "pull" ? "pull" : "push";
  const result = direction === "pull" ? await pullTicketFromGlpi(ticket) : await syncTicketWithGlpi(ticket);
  const updated = await updateStoredTicket(
    ticket.id,
    {
      ...(result.updates ?? {}),
      externalRef: result.externalRef,
    },
    tenantId,
  );

  await createAuditEvent({
    tenantId,
    ticketId: ticket.id,
    actor: "GLPI Adapter",
    action:
      result.status === "synced"
        ? direction === "pull"
          ? "Actualizacion GLPI recibida"
          : "Sincronizacion GLPI confirmada"
        : result.status === "failed"
          ? "Sincronizacion GLPI fallida"
          : "Sincronizacion GLPI en cola",
    detail: `${result.externalRef}. ${result.message}`,
  });

  return Response.json({
    data: updated,
    integration: result,
  }, { status: result.status === "failed" ? 502 : 200 });
}
