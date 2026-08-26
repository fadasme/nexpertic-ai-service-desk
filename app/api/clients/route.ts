import { requirePermission } from "@/lib/nexera/auth-store";
import { createClient, deleteClient, listClients, updateClient } from "@/lib/nexera/client-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "user:read");
  if (!authorization.allowed) return authorization.response;
  return Response.json({ data: await listClients(await tenantIdFromRequest(request)) });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; email?: unknown };
  try {
    const client = await createClient({ name: typeof body.name === "string" ? body.name : "", email: typeof body.email === "string" ? body.email : "" }, await tenantIdFromRequest(request));
    return Response.json({ data: client }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create client" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; name?: unknown; email?: unknown; status?: unknown };
  if (typeof body.id !== "string") return Response.json({ error: "id is required" }, { status: 400 });
  const client = await updateClient(body.id, { name: typeof body.name === "string" ? body.name.trim() : undefined, email: typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined, status: body.status === "Pendiente" ? "Pendiente" : "Activo" }, await tenantIdFromRequest(request));
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json({ data: client });
}

export async function DELETE(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !(await deleteClient(id, await tenantIdFromRequest(request)))) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
