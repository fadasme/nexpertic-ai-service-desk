import { getGlpiStatus } from "@/lib/nexera/glpi-adapter";
import { isDevConsentSecret } from "@/lib/nexera/consent-token";
import { getOidcConfig } from "@/lib/nexera/oidc-config";
import { getAuthMode, getSeedMode } from "@/lib/nexera/runtime-config";

export async function GET() {
  const glpi = getGlpiStatus();
  const oidc = getOidcConfig();

  return Response.json({
    status: "ok",
    product: "Nexpertic AI Service Desk",
    authMode: getAuthMode(),
    core: "Nexpertic API + D1 active",
    seedMode: getSeedMode(),
    integrations: {
      glpi: glpi.mode,
      oidc: oidc.mode,
      rustdesk: "session-persistence-active",
    },
    security: {
      consentTokenSigning: isDevConsentSecret() ? "dev-secret" : "configured",
    },
  });
}
