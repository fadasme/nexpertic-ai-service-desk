import { requirePermission } from "@/lib/nexera/auth-store";
import { createDevice, deleteDevice, listDevices, updateDevice } from "@/lib/nexera/device-store";
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

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "agent:read");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; name?: unknown; clientName?: unknown; status?: unknown };
  if (typeof body.id !== "string") return Response.json({ error: "id is required" }, { status: 400 });
  const device = await updateDevice(body.id, { name: typeof body.name === "string" ? body.name.trim() : undefined, clientName: typeof body.clientName === "string" ? body.clientName.trim() : undefined, status: body.status === "Pendiente" ? "Pendiente" : "Activo" }, await tenantIdFromRequest(request));
  if (!device) return Response.json({ error: "Device not found" }, { status: 404 });
  return Response.json({ data: device });
}

export async function DELETE(request: Request) {
  const authorization = await requirePermission(request, "agent:read");
  if (!authorization.allowed) return authorization.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !(await deleteDevice(id, await tenantIdFromRequest(request)))) return Response.json({ error: "Device not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
