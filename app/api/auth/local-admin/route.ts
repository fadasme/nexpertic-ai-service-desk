import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import { buildSessionSetCookie, clearSessionLockCookie, getSessionTtlMinutes, signSessionCookie } from "@/lib/nexera/session-cookie";
import { permissionsByRole } from "@/lib/nexera/auth-store";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { getLocalAdminCredentials } from "@/lib/nexera/runtime-config";
import type { SessionUser } from "@/lib/nexera/contracts";

function expiresAt() {
  return new Date(Date.now() + getSessionTtlMinutes() * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  const credentials = getLocalAdminCredentials();

  if (!credentials.enabled) {
    return Response.json({ error: "Local admin access is disabled" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (email !== credentials.email || password !== credentials.password) {
    await createSecurityEvent({
      action: "Local admin login failed",
      detail: `Invalid local admin credentials for ${email || "empty-email"}.`,
      fingerprint: email || "unknown-admin",
      severity: "warning",
      source: "auth",
      tenantId: DEFAULT_TENANT_ID,
    });

    return Response.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const session: SessionUser = {
    email,
    expiresAt: expiresAt(),
    id: "local-admin",
    name: "Administrador interno",
    permissions: permissionsByRole.Admin,
    role: "Admin",
    tenant: "Nexpertic",
    tenantId: DEFAULT_TENANT_ID,
  };
  const sessionCookie = await signSessionCookie(session);

  await createSecurityEvent({
    action: "Local admin login success",
    detail: `${email} opened an internal admin session.`,
    fingerprint: session.id,
    severity: "info",
    source: "auth",
    tenantId: DEFAULT_TENANT_ID,
  });

  const headers = new Headers();
  headers.append("set-cookie", buildSessionSetCookie(sessionCookie));
  headers.append("set-cookie", clearSessionLockCookie());

  return Response.json(
    {
      data: session,
      source: "local-admin",
    },
    { headers },
  );
}
