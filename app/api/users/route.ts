import { requirePermission } from "@/lib/nexera/auth-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { listUserAccounts } from "@/lib/nexera/user-store";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "user:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: await listUserAccounts(await tenantIdFromRequest(request)),
  });
}
