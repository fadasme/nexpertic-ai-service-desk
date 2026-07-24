import type { SessionUser, UserRole } from "./contracts";
import { allowsDemoAuthFallback } from "./runtime-config";
import { cookieValue, sessionCookieName, verifySessionCookie } from "./session-cookie";
import { DEFAULT_TENANT_ID } from "./tenant-context";

export const permissionsByRole: Record<UserRole, string[]> = {
  Usuario: ["ticket:create", "ticket:read:self", "knowledge:read"],
  Analista: ["ticket:read", "ticket:update", "ticket:sync-glpi", "rustdesk:read", "rustdesk:session", "audit:read", "audit:write", "knowledge:read", "agent:read"],
  Ejecutivo: ["dashboard:read", "ticket:read", "audit:read", "knowledge:read"],
  Admin: ["*", "user:read", "user:update"],
};

export const usersByRole: Record<UserRole, Omit<SessionUser, "permissions" | "role">> = {
  Usuario: {
    tenantId: DEFAULT_TENANT_ID,
    id: "usr-demo",
    name: "Usuario Demo",
    email: "usuario@nexera.demo",
    tenant: "Nexpertic Pilot",
  },
  Analista: {
    tenantId: DEFAULT_TENANT_ID,
    id: "ana-demo",
    name: "Analista L2",
    email: "analista@nexera.demo",
    tenant: "Nexpertic Pilot",
  },
  Ejecutivo: {
    tenantId: DEFAULT_TENANT_ID,
    id: "exec-demo",
    name: "Ejecutivo TI",
    email: "ejecutivo@nexera.demo",
    tenant: "Nexpertic Pilot",
  },
  Admin: {
    tenantId: DEFAULT_TENANT_ID,
    id: "admin-demo",
    name: "Admin IA",
    email: "admin@nexera.demo",
    tenant: "Nexpertic Pilot",
  },
};

export function getSession(role: UserRole = "Analista"): SessionUser {
  return {
    ...usersByRole[role],
    role,
    permissions: permissionsByRole[role],
  };
}

export function can(session: SessionUser, permission: string) {
  return session.permissions.includes("*") || session.permissions.includes(permission);
}

export function roleFromRequest(request: Request): UserRole {
  const { searchParams } = new URL(request.url);
  const requestedRole = request.headers.get("x-nexera-role") ?? searchParams.get("role");
  const roles: UserRole[] = ["Usuario", "Analista", "Ejecutivo", "Admin"];

  return roles.includes(requestedRole as UserRole) ? (requestedRole as UserRole) : "Analista";
}

export function isUserRole(value: unknown): value is UserRole {
  const roles: UserRole[] = ["Usuario", "Analista", "Ejecutivo", "Admin"];
  return roles.includes(value as UserRole);
}

export async function sessionFromRequest(request: Request) {
  const cookieSession = await verifySessionCookie(cookieValue(request, sessionCookieName()));
  if (cookieSession) {
    return {
      ...cookieSession,
      tenantId: cookieSession.tenantId ?? DEFAULT_TENANT_ID,
    };
  }

  if (!allowsDemoAuthFallback()) return null;

  return getSession(roleFromRequest(request));
}

export async function requirePermission(request: Request, permission: string) {
  const session = await sessionFromRequest(request);

  if (!session) {
    return {
      allowed: false as const,
      response: Response.json(
        {
          authMode: "production",
          error: "Unauthorized",
          required: "signed-session-cookie",
        },
        { status: 401 },
      ),
      session: null,
    };
  }

  if (!can(session, permission)) {
    return {
      allowed: false as const,
      response: Response.json(
        {
          error: "Forbidden",
          requiredPermission: permission,
          role: session.role,
        },
        { status: 403 },
      ),
      session,
    };
  }

  return {
    allowed: true as const,
    session,
  };
}
