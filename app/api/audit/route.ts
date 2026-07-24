import { createAuditEvent, listAuditEvents } from "@/lib/nexera/audit-store";
import { requirePermission } from "@/lib/nexera/auth-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import type { CreateAuditEventInput } from "@/lib/nexera/contracts";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("ticketId") ?? undefined;
  const tenantId = await tenantIdFromRequest(request);

  return Response.json({
    data: await listAuditEvents(ticketId, tenantId),
  });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "audit:write");
  if (!authorization.allowed) return authorization.response;

  const body = (await request.json().catch(() => ({}))) as Partial<CreateAuditEventInput>;
  const tenantId = await tenantIdFromRequest(request);

  if (!body.ticketId || !body.actor || !body.action || !body.detail) {
    return Response.json({ error: "ticketId, actor, action and detail are required" }, { status: 400 });
  }

  const ticketExists = (await listStoredTickets({ tenantId })).some((ticket) => ticket.id === body.ticketId);
  if (!ticketExists) {
    return Response.json({ error: "Ticket not found for tenant" }, { status: 404 });
  }

  const event = await createAuditEvent({
    tenantId,
    ticketId: body.ticketId,
    actor: body.actor,
    action: body.action,
    detail: body.detail,
  });

  return Response.json({ data: event }, { status: 201 });
}
