import { requirePermission } from "@/lib/nexera/auth-store";
import { getTicketSettings, updateTicketSettings } from "@/lib/nexera/ticket-settings-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import type { TicketSettings } from "@/lib/nexera/contracts";

export async function GET(request: Request) { const authorization = await requirePermission(request, "user:read"); if (!authorization.allowed) return authorization.response; return Response.json({ data: await getTicketSettings(await tenantIdFromRequest(request)) }); }
export async function PATCH(request: Request) { const authorization = await requirePermission(request, "user:update"); if (!authorization.allowed) return authorization.response; const body = (await request.json().catch(() => ({}))) as Partial<TicketSettings>; const settings: TicketSettings = { defaultPriority: body.defaultPriority === "Critica" || body.defaultPriority === "Alta" ? body.defaultPriority : "Media", defaultOwner: typeof body.defaultOwner === "string" && body.defaultOwner.trim() ? body.defaultOwner.trim() : "Mesa L1", autoAssign: body.autoAssign !== false, allowRequesterReply: body.allowRequesterReply !== false }; return Response.json({ data: await updateTicketSettings(settings, await tenantIdFromRequest(request)) }); }
