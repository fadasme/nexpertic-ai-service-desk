import { getOidcConfig, randomOidcValue, signOidcState } from "@/lib/nexera/oidc-config";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const config = getOidcConfig();

  if (config.mode !== "configured" || !config.authorizationUrl || !config.redirectUri || !process.env.OIDC_CLIENT_ID) {
    return Response.json(
      {
        error: "OIDC is not configured",
        requiredEnv: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"],
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const nonce = randomOidcValue();
  const state = await signOidcState(nonce, safeReturnTo(searchParams.get("returnTo")));
  const authorizationUrl = new URL(config.authorizationUrl);

  authorizationUrl.searchParams.set("client_id", process.env.OIDC_CLIENT_ID);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("prompt", "select_account");
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_mode", "query");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", config.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);

  return new Response(null, {
    headers: {
      location: authorizationUrl.toString(),
      "set-cookie": `nexera_oidc_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    },
    status: 302,
  });
}
