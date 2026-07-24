import { requirePermission } from "@/lib/nexera/auth-store";
import { getOidcJwksStatus } from "@/lib/nexera/oidc-config";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: await getOidcJwksStatus(),
  });
}
