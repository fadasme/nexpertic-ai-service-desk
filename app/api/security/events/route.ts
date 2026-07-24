import { requirePermission } from "@/lib/nexera/auth-store";
import { listSecurityEvents } from "@/lib/nexera/security-event-store";
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
