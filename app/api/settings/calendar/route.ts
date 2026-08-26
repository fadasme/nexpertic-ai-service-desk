import { requirePermission } from "@/lib/nexera/auth-store";
import { getCalendarSettings, updateCalendarSettings } from "@/lib/nexera/calendar-settings-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import type { CalendarSettings } from "@/lib/nexera/contracts";

export async function GET(request: Request) { const authorization = await requirePermission(request, "user:read"); if (!authorization.allowed) return authorization.response; return Response.json({ data: await getCalendarSettings(await tenantIdFromRequest(request)) }); }
export async function PATCH(request: Request) { const authorization = await requirePermission(request, "user:update"); if (!authorization.allowed) return authorization.response; const body = (await request.json().catch(() => ({}))) as Partial<CalendarSettings>; const provider = body.provider === "Google Calendar" || body.provider === "iCal" ? body.provider : "Microsoft 365"; const settings: CalendarSettings = { provider, calendarId: typeof body.calendarId === "string" ? body.calendarId.trim() : "", timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "America/Santiago", syncEnabled: body.syncEnabled === true }; return Response.json({ data: await updateCalendarSettings(settings, await tenantIdFromRequest(request)) }); }
