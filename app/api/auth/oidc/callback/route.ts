import { createSecurityEvent } from "@/lib/nexera/security-event-store";
import { exchangeAuthorizationCode, getOidcConfig, mapClaimsToUserAccount, verifyIdTokenClaims, verifyOidcState } from "@/lib/nexera/oidc-config";
import { buildSessionSetCookie, signSessionCookie } from "@/lib/nexera/session-cookie";
import { listUserAccounts } from "@/lib/nexera/user-store";

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function GET(request: Request) {
  const config = getOidcConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const storedState = cookieValue(request, "nexera_oidc_state");
  const verifiedState = await verifyOidcState(state);

  if (error) {
    await createSecurityEvent({
      action: "OIDC callback rejected",
      detail: `Provider returned error ${error}.`,
      fingerprint: error,
      severity: "warning",
      source: "auth",
    });
    return Response.json({ error: "OIDC provider rejected authentication", providerError: error }, { status: 401 });
  }

  if (config.mode !== "configured") {
    return Response.json({ error: "OIDC is not configured" }, { status: 503 });
  }

  if (!code || !state || !verifiedState || storedState !== state) {
    await createSecurityEvent({
      action: "OIDC callback state failed",
      detail: "Missing, expired or mismatched OIDC state during callback.",
      fingerprint: state?.slice(0, 12) ?? "missing-state",
      severity: "critical",
      source: "auth",
    });
    return Response.json({ error: "Invalid OIDC callback state" }, { status: 400 });
  }

  try {
    const tokenResponse = await exchangeAuthorizationCode(code);
    const claims = await verifyIdTokenClaims(tokenResponse.id_token!, verifiedState.nonce);
    const users = await listUserAccounts();
    const mappedUser = mapClaimsToUserAccount(claims, users);
    const user = mappedUser.userId ? users.find((item) => item.id === mappedUser.userId) : null;

    if (!user) {
      throw new Error("OIDC user is not provisioned in Nexpertic");
    }

    const session = {
      email: user.email,
      id: user.id,
      name: user.name,
      permissions: user.permissions,
      role: user.role,
      tenant: user.tenant,
      tenantId: user.tenantId,
    };
    const sessionCookie = await signSessionCookie(session);

    await createSecurityEvent({
      tenantId: user.tenantId,
      action: "OIDC callback mapped",
      detail: `${claims.email} mapped to role ${mappedUser.role}${mappedUser.matched ? " via existing user" : " via fallback policy"}.`,
      fingerprint: claims.externalId,
      severity: mappedUser.matched ? "info" : "warning",
      source: "auth",
    });

    const headers = new Headers();
    headers.append("set-cookie", "nexera_oidc_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    headers.append("set-cookie", buildSessionSetCookie(sessionCookie));

    return Response.json(
      {
        data: {
          claims,
          mappedUser,
          validation: "ID token signature, issuer, audience, expiration and nonce verified.",
          returnTo: verifiedState.returnTo,
        },
      },
      {
        headers,
      },
    );
  } catch (error) {
    await createSecurityEvent({
      action: "OIDC token exchange failed",
      detail: error instanceof Error ? error.message : "OIDC token exchange failed.",
      fingerprint: verifiedState.nonce.slice(0, 12),
      severity: "critical",
      source: "auth",
    });

    return Response.json(
      {
        error: error instanceof Error ? error.message : "OIDC token exchange failed",
      },
      {
        headers: {
          "set-cookie": "nexera_oidc_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        },
        status: 502,
      },
    );
  }
}
