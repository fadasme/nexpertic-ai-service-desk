import { requirePermission } from "@/lib/nexera/auth-store";
import { getSlaConfig, updateSlaConfig } from "@/lib/nexera/sla-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "user:read");
  if (!authorization.allowed) return authorization.response;
  return Response.json({ data: await getSlaConfig(await tenantIdFromRequest(request)) });
}

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as Partial<{ responseMinutes: number; resolutionMinutes: number; businessStart: string; businessEnd: string; timezone: string }>;
  try {
    const data = await updateSlaConfig({ responseMinutes: Number(body.responseMinutes), resolutionMinutes: Number(body.resolutionMinutes), businessStart: String(body.businessStart ?? ""), businessEnd: String(body.businessEnd ?? ""), timezone: String(body.timezone ?? "") }, await tenantIdFromRequest(request));
    return Response.json({ data });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar SLA" }, { status: 400 }); }
}
