import { requirePermission } from "@/lib/nexera/auth-store";
import { getOidcConfig } from "@/lib/nexera/oidc-config";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  const config = getOidcConfig();

  return Response.json({
    data: {
      ...config,
      nextStep:
        config.mode === "configured"
          ? "Implement authorization-code callback and signed session cookie."
          : "Set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET and OIDC_REDIRECT_URI.",
      validation: {
        jwksStatusEndpoint: "/api/auth/oidc/jwks/status",
        productionRequired: ["issuer", "audience", "expiration", "nonce", "jwks-signature"],
      },
    },
  });
}
