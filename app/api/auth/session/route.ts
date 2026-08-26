import { getSession, isUserRole } from "@/lib/nexera/auth-store";
import { allowsDemoAuthFallback } from "@/lib/nexera/runtime-config";
import {
  buildSessionSetCookie,
  clearSessionLockCookie,
  cookieValue,
  getSessionTtlMinutes,
  sessionCookieName,
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/nexera/session-cookie";
import { getUserAccount, listUserAccounts } from "@/lib/nexera/user-store";
import type { SessionUser, UserRole } from "@/lib/nexera/contracts";

function sessionExpiresAt() {
  return new Date(Date.now() + getSessionTtlMinutes() * 60 * 1000).toISOString();
}

function userSession(user: Awaited<ReturnType<typeof getUserAccount>>): SessionUser | null {
  if (!user) return null;

  return {
    email: user.email,
    expiresAt: sessionExpiresAt(),
    id: user.id,
    name: user.name,
    permissions: user.permissions,
    role: user.role,
    tenant: user.tenant,
    tenantId: user.tenantId,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const requestedRole = searchParams.get("role") as UserRole | null;
  const cookieSession = await verifySessionCookie(cookieValue(request, sessionCookieName()));

  if (!userId && !requestedRole && cookieSession) {
    return Response.json({ data: cookieSession, source: "signed-cookie" });
  }

  if (userId) {
    const user = await getUserAccount(userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      data: userSession(user),
    });
  }

  const role = isUserRole(requestedRole) ? requestedRole : "Analista";
  const users = await listUserAccounts();
  const user = users.find((item) => item.role === role);

  if (user) {
    return Response.json({
      data: userSession(user),
    });
  }

  return Response.json({
    data: getSession(role),
  });
}

export async function POST(request: Request) {
  if (!allowsDemoAuthFallback()) {
    return Response.json(
      {
        authMode: "production",
        error: "Demo session switching is disabled",
        required: "OIDC login or signed session",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const user = await getUserAccount(userId);
  const session = userSession(user);

  if (!session) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const sessionCookie = await signSessionCookie(session);

  const headers = new Headers();
  headers.append("set-cookie", buildSessionSetCookie(sessionCookie));
  headers.append("set-cookie", clearSessionLockCookie());

  return Response.json(
    {
      data: session,
      source: "demo-signed-cookie",
    },
    { headers },
  );
}

export async function PATCH(request: Request) {
  const current = await verifySessionCookie(cookieValue(request, sessionCookieName()));
  if (!current) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; email?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : current.name;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : current.email;
  if (!name || !email || !email.includes("@")) return Response.json({ error: "Nombre y correo válidos son obligatorios" }, { status: 400 });
  const session = { ...current, name, email, expiresAt: sessionExpiresAt() };
  const headers = new Headers();
  headers.append("set-cookie", buildSessionSetCookie(await signSessionCookie(session)));
  return Response.json({ data: session }, { headers });
}
