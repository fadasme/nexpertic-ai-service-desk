import { requirePermission } from "@/lib/nexera/auth-store";
import { createClient, listClients } from "@/lib/nexera/client-store";
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
