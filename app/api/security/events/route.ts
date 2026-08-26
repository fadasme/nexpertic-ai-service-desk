import { requirePermission } from "@/lib/nexera/auth-store";
import { acknowledgeSecurityEvent, listSecurityEvents } from "@/lib/nexera/security-event-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import type { SecurityEvent } from "@/lib/nexera/contracts";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") as SecurityEvent["source"] | null;
  const tenantId = await tenantIdFromRequest(request);

  return Response.json({
    data: await listSecurityEvents(source ?? undefined, tenantId),
  });
}

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "audit:write");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (typeof body.id !== "string") return Response.json({ error: "id is required" }, { status: 400 });
  const acknowledgedAt = await acknowledgeSecurityEvent(body.id, await tenantIdFromRequest(request));
  if (!acknowledgedAt) return Response.json({ error: "Security event not found" }, { status: 404 });
  return Response.json({ data: { id: body.id, acknowledgedAt } });
}
