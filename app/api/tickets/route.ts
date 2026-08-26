import { createStoredTicket, listStoredTickets } from "@/lib/nexera/ticket-store";
import { can, requirePermission } from "@/lib/nexera/auth-store";
import { createAuditEvent } from "@/lib/nexera/audit-store";
import { suggestKnowledgeArticle } from "@/lib/nexera/knowledge-search";
import { listKnowledgeArticles } from "@/lib/nexera/service";
import { listAutomationRules } from "@/lib/nexera/automation-store";
import { getTicketSettings } from "@/lib/nexera/ticket-settings-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import type { CreateTicketInput, TicketPriority } from "@/lib/nexera/contracts";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "ticket:read");
  if (!authorization.allowed && (!authorization.session || !can(authorization.session, "ticket:read:self"))) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const priority = searchParams.get("priority") as TicketPriority | "Todas" | null;
  const q = searchParams.get("q") ?? undefined;
  const tenantId = await tenantIdFromRequest(request);
  const requester = authorization.allowed ? undefined : authorization.session?.email;

  return Response.json({
    data: await listStoredTickets({ priority: priority ?? undefined, q, requester, tenantId }),
  });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "ticket:create");
  if (!authorization.allowed) return authorization.response;

  const body = (await request.json().catch(() => ({}))) as Partial<CreateTicketInput>;
  const tenantId = await tenantIdFromRequest(request);
  const requester = can(authorization.session, "ticket:read") || can(authorization.session, "ticket:update")
    ? body.requester
    : authorization.session.email;

  try {
    let ticket = await createStoredTicket({
      tenantId,
      description: String(body.description ?? ""),
      requester,
      source: body.source,
      customFields: body.customFields && typeof body.customFields === "object" ? body.customFields : undefined,
    });
    const description = String(body.description ?? "").toLowerCase();
    const ticketSettings = await getTicketSettings(tenantId);
    const configuredTicket = await updateStoredTicket(ticket.id, { priority: ticketSettings.defaultPriority, owner: ticketSettings.autoAssign ? ticketSettings.defaultOwner : ticket.owner }, tenantId);
    if (configuredTicket) ticket = configuredTicket;
    const matchedRules = (await listAutomationRules(tenantId)).filter((rule) => rule.enabled && description.includes(rule.matchText.toLowerCase()));
    for (const rule of matchedRules) {
      const next = await updateStoredTicket(ticket.id, rule.action === "Prioridad Alta" ? { priority: "Alta" } : { owner: "Mesa L1" }, tenantId);
      if (next) ticket = next;
      await createAuditEvent({ action: "Regla de automatización aplicada", actor: "Agente IA", detail: `${rule.name} · ${rule.action}.`, tenantId, ticketId: ticket.id });
    }
    const knowledgeSuggestion = suggestKnowledgeArticle(listKnowledgeArticles(), String(body.description ?? ""));

    await createAuditEvent({
      action: "Ticket creado via API",
      actor: "Usuario",
      detail: `Canal ${ticket.source}. Solicitante: ${ticket.requester}.`,
      tenantId,
      ticketId: ticket.id,
    });
    await createAuditEvent({
      action: "Clasificacion y enriquecimiento",
      actor: "Agente IA",
      detail: `${ticket.category}, prioridad ${ticket.priority}, confianza ${ticket.confidence}%.`,
      tenantId,
      ticketId: ticket.id,
    });
    if (knowledgeSuggestion) {
      await createAuditEvent({
        action: "Knowledge sugerido",
        actor: "Agente IA",
        detail: `${knowledgeSuggestion.id} · ${knowledgeSuggestion.title}.`,
        tenantId,
        ticketId: ticket.id,
      });
    }

    return Response.json({ data: ticket }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to create ticket",
      },
      { status: 400 },
    );
  }
}
