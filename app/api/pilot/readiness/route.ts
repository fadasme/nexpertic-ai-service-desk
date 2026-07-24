import { requirePermission } from "@/lib/nexera/auth-store";
import { getPilotReadiness } from "@/lib/nexera/pilot-readiness";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: getPilotReadiness(),
  });
}
