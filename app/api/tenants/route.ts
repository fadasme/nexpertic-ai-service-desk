import { requirePermission } from "@/lib/nexera/auth-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { listTenantConfigs } from "@/lib/nexera/tenant-store";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "user:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: await listTenantConfigs(await tenantIdFromRequest(request)),
  });
}
