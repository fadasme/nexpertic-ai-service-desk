import { requirePermission } from "@/lib/nexera/auth-store";
import { signConsentToken } from "@/lib/nexera/consent-token";
import { createStoredRemoteSupportSession, listRemoteSupportSessions, updateStoredRemoteSupportSession } from "@/lib/nexera/remote-support-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import type { RemoteSupportSession, UpdateRemoteSupportSessionInput } from "@/lib/nexera/contracts";

const allowedStatuses: RemoteSupportSession["status"][] = ["Esperando consentimiento", "Invitacion enviada", "Conectado"];

async function signedSession(session: RemoteSupportSession) {
  return {
    ...session,
    consentToken: await signConsentToken(session.consentToken, session.consentExpiresAt, session.tenantId),
  };
}

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "rustdesk:session");
  if (!authorization.allowed) return authorization.response;

  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("ticketId") ?? undefined;
  const tenantId = await tenantIdFromRequest(request);
  const sessions = await listRemoteSupportSessions(ticketId, tenantId);

  return Response.json({
    data: await Promise.all(sessions.map(signedSession)),
  });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "rustdesk:session");
  if (!authorization.allowed) return authorization.response;

  const body = await request.json().catch(() => ({}));
  const ticketId = typeof body.ticketId === "string" ? body.ticketId : "NX-DEMO";
  const tenantId = await tenantIdFromRequest(request);
  const ticketExists = (await listStoredTickets({ tenantId })).some((ticket) => ticket.id === ticketId);

  if (!ticketExists) {
    return Response.json({ error: "Ticket not found for tenant" }, { status: 404 });
  }

  const session = await createStoredRemoteSupportSession({ tenantId, ticketId });

  return Response.json({
    data: await signedSession(session),
    audit:
      "Sesion remota persistida en D1 cuando el binding DB esta disponible. En produccion debe exigir consentimiento del usuario y politicas por tenant.",
  });
}

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "rustdesk:session");
  if (!authorization.allowed) return authorization.response;

  const body = (await request.json().catch(() => ({}))) as Partial<UpdateRemoteSupportSessionInput> & { id?: string };
  const tenantId = await tenantIdFromRequest(request);

  if (!body.id || !body.status || !allowedStatuses.includes(body.status)) {
    return Response.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const current = (await listRemoteSupportSessions(undefined, tenantId)).find((session) => session.id === body.id);

  if (!current) {
    return Response.json({ error: "Remote support session not found" }, { status: 404 });
  }

  const consentGrantedAt = current.consentGrantedAt;

  if (body.status === "Conectado" && !consentGrantedAt) {
    return Response.json({ error: "User consent is required before connecting" }, { status: 409 });
  }

  if (body.status === "Conectado" && current.consentRejectedAt) {
    return Response.json({ error: "User rejected remote support consent" }, { status: 409 });
  }

  const session = await updateStoredRemoteSupportSession(body.id, {
    consentGrantedAt,
    consentRejectedAt: current.consentRejectedAt,
    status: body.status,
  });

  if (!session) {
    return Response.json({ error: "Remote support session not found" }, { status: 404 });
  }

  return Response.json({ data: await signedSession(session) });
}
