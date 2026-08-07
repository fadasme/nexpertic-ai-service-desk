import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import {
  buildSessionLockCookie,
  cookieValue,
  sessionCookieName,
  verifySessionCookie,
} from "@/lib/nexera/session-cookie";

export async function POST(request: Request) {
  const session = await verifySessionCookie(cookieValue(request, sessionCookieName()));
  const wantsHtml = request.headers.get("accept")?.includes("text/html");

  if (!session) {
    return Response.json(
      {
        error: "No active session found",
      },
      { status: 401 },
    );
  }

  await createSecurityEvent({
    action: "Session locked",
    detail: `${session.email} locked the current workspace.`,
    fingerprint: session.id,
    severity: "info",
    source: "auth",
    tenantId: session.tenantId,
  });

  if (wantsHtml) {
    const headers = new Headers();
    headers.append("set-cookie", await buildSessionLockCookie(session));
    headers.set("location", "/signin?mode=unlock&returnTo=/");
    return new Response(null, { headers, status: 303 });
  }

  return Response.json(
    {
      data: {
        locked: true,
      },
    },
    {
      headers: {
        "set-cookie": await buildSessionLockCookie(session),
      },
    },
  );
}
