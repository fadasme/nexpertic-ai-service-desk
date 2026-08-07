import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import {
  clearSessionCookie,
  clearSessionLockCookie,
  cookieValue,
  sessionCookieName,
  verifySessionCookie,
} from "@/lib/nexera/session-cookie";

export async function POST(request: Request) {
  const session = await verifySessionCookie(cookieValue(request, sessionCookieName()));
  const wantsHtml = request.headers.get("accept")?.includes("text/html");

  if (session) {
    await createSecurityEvent({
      tenantId: session.tenantId,
      action: "Session logout",
      detail: `${session.email} closed a signed session.`,
      fingerprint: session.id,
      severity: "info",
      source: "auth",
    });
  }

  const headers = new Headers();
  headers.append("set-cookie", clearSessionCookie());
  headers.append("set-cookie", clearSessionLockCookie());

  if (wantsHtml) {
    headers.set("location", "/signin");
    return new Response(null, { headers, status: 303 });
  }

  return Response.json(
    {
      data: {
        loggedOut: true,
        sessionFound: Boolean(session),
      },
    },
    { headers },
  );
}
