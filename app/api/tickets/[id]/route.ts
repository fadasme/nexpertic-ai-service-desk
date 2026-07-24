import { updateStoredTicket } from "@/lib/nexera/ticket-store";
import { requirePermission } from "@/lib/nexera/auth-store";
import { hasTicketUpdate, sanitizeTicketUpdate } from "@/lib/nexera/ticket-update-policy";
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
  const ticket = await updateStoredTicket(id, update, tenantId);

  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }

  return Response.json({ data: ticket });
}
