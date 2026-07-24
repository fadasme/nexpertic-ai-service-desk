import { isUserRole, requirePermission } from "@/lib/nexera/auth-store";
import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";
import { updateUserRole } from "@/lib/nexera/user-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;

  const body = (await request.json().catch(() => ({}))) as { role?: unknown };

  if (!isUserRole(body.role)) {
    return Response.json({ error: "Valid role is required" }, { status: 400 });
  }

  const { id } = await context.params;
  const tenantId = await tenantIdFromRequest(request);
  const user = await updateUserRole(id, { role: body.role }, tenantId);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  await createSecurityEvent({
    tenantId: authorization.session.tenantId,
    action: "User role changed",
    detail: `${authorization.session.name} changed ${user.email} to role ${user.role}.`,
    fingerprint: user.id,
    severity: user.role === "Admin" ? "critical" : "warning",
    source: "admin",
  });

  return Response.json({ data: user });
}
