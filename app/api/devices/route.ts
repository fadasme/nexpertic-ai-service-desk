import { requirePermission } from "@/lib/nexera/auth-store";
import { createDevice, listDevices } from "@/lib/nexera/device-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "agent:read");
  if (!authorization.allowed) return authorization.response;
  return Response.json({ data: await listDevices(await tenantIdFromRequest(request)) });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "agent:read");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; clientName?: unknown };
  try {
    const device = await createDevice({ name: typeof body.name === "string" ? body.name : "", clientName: typeof body.clientName === "string" ? body.clientName : "" }, await tenantIdFromRequest(request));
    return Response.json({ data: device }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create device" }, { status: 400 });
  }
}
