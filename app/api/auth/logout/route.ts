import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import { clearSessionCookie, cookieValue, sessionCookieName, verifySessionCookie } from "@/lib/nexera/session-cookie";

export async function POST(request: Request) {
  const session = await verifySessionCookie(cookieValue(request, sessionCookieName()));

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

  return Response.json(
    {
      data: {
        loggedOut: true,
        sessionFound: Boolean(session),
      },
    },
    {
      headers: {
        "set-cookie": clearSessionCookie(),
      },
    },
  );
}
