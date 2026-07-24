import { cookieValue, sessionCookieName, verifySessionCookie } from "./session-cookie";

export const DEFAULT_TENANT_ID = "tenant-nexera-pilot";

export async function tenantIdFromRequest(request: Request) {
  const session = await verifySessionCookie(cookieValue(request, sessionCookieName()));
  const sessionTenantId = session?.tenantId?.trim();
  if (sessionTenantId) return sessionTenantId;

  const headerTenantId = request.headers.get("x-nexera-tenant")?.trim();
  return headerTenantId || DEFAULT_TENANT_ID;
}
