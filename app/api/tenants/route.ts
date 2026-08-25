import { requirePermission } from "@/lib/nexera/auth-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { listTenantConfigs, updateTenantConfig } from "@/lib/nexera/tenant-store";
import type { UpdateTenantConfigInput } from "@/lib/nexera/contracts";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "user:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: await listTenantConfigs(await tenantIdFromRequest(request)),
  });
}

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const tenantId = await tenantIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as UpdateTenantConfigInput;
  if (body.name !== undefined && (!body.name.trim() || body.name.length > 120)) {
    return Response.json({ error: "name must be between 1 and 120 characters" }, { status: 400 });
  }
  const tenant = await updateTenantConfig(tenantId, body);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });
  return Response.json({ data: tenant });
}
