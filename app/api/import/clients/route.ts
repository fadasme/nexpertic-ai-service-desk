import { requirePermission } from "@/lib/nexera/auth-store";
import { createClient } from "@/lib/nexera/client-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "CSV file is required" }, { status: 400 });
  const lines = (await file.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return Response.json({ error: "El CSV debe incluir encabezado y al menos una fila." }, { status: 400 });
  const header = lines.shift()?.toLowerCase().replaceAll(" ", "") ?? "";
  if (!header.includes("nombre") || !header.includes("correo")) return Response.json({ error: "El encabezado debe contener nombre y correo." }, { status: 400 });
  const tenantId = await tenantIdFromRequest(request);
  let imported = 0;
  let skipped = 0;
  for (const line of lines) {
    const [name, email] = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    if (!name || !email || !email.includes("@")) { skipped += 1; continue; }
    try { await createClient({ name, email }, tenantId); imported += 1; } catch { skipped += 1; }
  }
  return Response.json({ data: { imported, skipped } });
}
