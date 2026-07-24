import { requirePermission } from "@/lib/nexera/auth-store";
import { listAgents } from "@/lib/nexera/service";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "agent:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: listAgents(),
  });
}
