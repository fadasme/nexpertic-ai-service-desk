import { requirePermission } from "@/lib/nexera/auth-store";
import { getMailStatus } from "@/lib/nexera/mail-adapter";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: getMailStatus(),
  });
}
