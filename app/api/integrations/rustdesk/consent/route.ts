import { createAuditEvent } from "@/lib/nexera/audit-store";
import { verifyConsentToken } from "@/lib/nexera/consent-token";
import { listRemoteSupportSessions, updateStoredRemoteSupportSession } from "@/lib/nexera/remote-support-store";
import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import type { RemoteSupportSession } from "@/lib/nexera/contracts";

function publicSession(session: RemoteSupportSession) {
  return {
    code: session.code,
    consentExpiresAt: session.consentExpiresAt,
    consentGrantedAt: session.consentGrantedAt,
    consentRejectedAt: session.consentRejectedAt,
    expiresInMinutes: session.expiresInMinutes,
    provider: session.provider,
    status: session.status,
    ticketId: session.ticketId,
  };
}

function isExpired(session: RemoteSupportSession) {
  return Date.now() > new Date(session.consentExpiresAt).getTime();
}

function fingerprint(token?: string | null) {
  return token ? token.slice(0, 10) : "missing-token";
}

function consentTokenMatches(session: RemoteSupportSession, verified: Awaited<ReturnType<typeof verifyConsentToken>> | null) {
  if (!verified || session.consentToken !== verified.rawToken) return false;
  return !verified.tenantId || session.tenantId === verified.tenantId;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const verified = token ? await verifyConsentToken(token) : null;
  const session = (await listRemoteSupportSessions(undefined, verified?.tenantId)).find((item) => consentTokenMatches(item, verified));

  if (!token || !verified || !session) {
    await createSecurityEvent({
      action: "Consent token lookup failed",
      detail: "Invalid, missing or tampered RustDesk consent token used in GET.",
      fingerprint: fingerprint(token),
      severity: "warning",
      source: "rustdesk-consent",
    });
    return Response.json({ error: "Consent request not found" }, { status: 404 });
  }

  if (isExpired(session) && !session.consentGrantedAt && !session.consentRejectedAt) {
    await createSecurityEvent({
      tenantId: session.tenantId,
      action: "Expired consent token opened",
      detail: `Expired consent token opened for session ${session.code}.`,
      fingerprint: fingerprint(token),
      severity: "warning",
      source: "rustdesk-consent",
      ticketId: session.ticketId,
    });
    return Response.json({ error: "Consent request expired", data: publicSession(session) }, { status: 410 });
  }

  return Response.json({ data: publicSession(session) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { decision?: "approve" | "reject"; token?: string };

  if (body.decision !== "approve" && body.decision !== "reject") {
    return Response.json({ error: "decision must be approve or reject" }, { status: 400 });
  }

  const verified = body.token ? await verifyConsentToken(body.token) : null;
  const session = (await listRemoteSupportSessions(undefined, verified?.tenantId)).find((item) => consentTokenMatches(item, verified));

  if (!body.token || !verified || !session) {
    await createSecurityEvent({
      action: "Consent decision token failed",
      detail: "Invalid, missing or tampered RustDesk consent token used in POST.",
      fingerprint: fingerprint(body.token),
      severity: "warning",
      source: "rustdesk-consent",
    });
    return Response.json({ error: "Consent request not found" }, { status: 404 });
  }

  if (isExpired(session)) {
    await createSecurityEvent({
      tenantId: session.tenantId,
      action: "Expired consent decision blocked",
      detail: `Expired consent decision blocked for session ${session.code}.`,
      fingerprint: fingerprint(body.token),
      severity: "warning",
      source: "rustdesk-consent",
      ticketId: session.ticketId,
    });
    await createAuditEvent({
      tenantId: session.tenantId,
      ticketId: session.ticketId,
      actor: "RustDesk",
      action: "Consentimiento RustDesk expirado",
      detail: `Sesion ${session.code}.`,
    });
    return Response.json({ error: "Consent request expired", data: publicSession(session) }, { status: 410 });
  }

  if (session.consentGrantedAt || session.consentRejectedAt) {
    await createSecurityEvent({
      tenantId: session.tenantId,
      action: "Consent replay blocked",
      detail: `Repeated consent decision blocked for session ${session.code}.`,
      fingerprint: fingerprint(body.token),
      severity: "warning",
      source: "rustdesk-consent",
      ticketId: session.ticketId,
    });
    return Response.json({ error: "Consent request already answered", data: publicSession(session) }, { status: 409 });
  }

  const timestamp = new Date().toISOString();
  const updated = await updateStoredRemoteSupportSession(session.id, {
    consentGrantedAt: body.decision === "approve" ? timestamp : undefined,
    consentRejectedAt: body.decision === "reject" ? timestamp : undefined,
    status: body.decision === "approve" ? session.status : "Esperando consentimiento",
  });

  if (!updated) {
    return Response.json({ error: "Unable to update consent request" }, { status: 500 });
  }

  await createAuditEvent({
    tenantId: updated.tenantId,
    ticketId: updated.ticketId,
    actor: "Usuario",
    action: body.decision === "approve" ? "Consentimiento RustDesk aprobado" : "Consentimiento RustDesk rechazado",
    detail: `Sesion ${updated.code}.`,
  });

  return Response.json({ data: publicSession(updated) });
}
