import { isDevConsentSecret } from "./consent-token";
import { getGlpiStatus } from "./glpi-adapter";
import { getOidcConfig, isDevOidcStateSecret } from "./oidc-config";
import { demoCleanupPostureFromEnv } from "./secret-posture-demo-cleanup";
import { allowsDemoAuthFallback, getAuthMode } from "./runtime-config";
import { isDevSessionSecret } from "./session-cookie";
import type { SecretPosture, SecretPostureItem } from "./contracts";

function configured(value?: string) {
  return Boolean(value && value.trim());
}

function item(input: SecretPostureItem): SecretPostureItem {
  return input;
}

export function getSecretPosture(): SecretPosture {
  const oidc = getOidcConfig();
  const glpi = getGlpiStatus();
  const consentDev = isDevConsentSecret();
  const authMode = getAuthMode();
  const oidcStateDev = isDevOidcStateSecret();
  const sessionDev = isDevSessionSecret();

  const items = [
    item({
      configured: authMode === "production",
      devFallback: allowsDemoAuthFallback(),
      key: "NEXERA_AUTH_MODE",
      label: "Modo autorizacion",
      risk: authMode === "production" ? "ok" : "warning",
    }),
    item({
      configured: !consentDev,
      devFallback: consentDev,
      key: "NEXERA_CONSENT_SECRET",
      label: "Firma consentimiento RustDesk",
      risk: consentDev ? "critical" : "ok",
    }),
    item({
      configured: !sessionDev,
      devFallback: sessionDev,
      key: "NEXERA_SESSION_SECRET",
      label: "Firma cookie de sesion",
      risk: sessionDev ? "critical" : "ok",
    }),
    item({
      configured: !oidcStateDev,
      devFallback: oidcStateDev,
      key: "NEXERA_OIDC_STATE_SECRET",
      label: "Firma state OIDC",
      risk: oidcStateDev ? "critical" : "ok",
    }),
    item({
      configured: oidc.clientIdConfigured,
      key: "OIDC_CLIENT_ID",
      label: "OIDC client id",
      risk: oidc.clientIdConfigured ? "ok" : "warning",
    }),
    item({
      configured: oidc.clientSecretConfigured,
      key: "OIDC_CLIENT_SECRET",
      label: "OIDC client secret",
      risk: oidc.clientSecretConfigured ? "ok" : "critical",
    }),
    item({
      configured: configured(oidc.issuer),
      key: "OIDC_ISSUER",
      label: "OIDC issuer",
      risk: configured(oidc.issuer) ? "ok" : "warning",
    }),
    item({
      configured: configured(oidc.redirectUri),
      key: "OIDC_REDIRECT_URI",
      label: "OIDC redirect URI",
      risk: configured(oidc.redirectUri) ? "ok" : "warning",
    }),
    item({
      configured: glpi.configured,
      key: "GLPI_*",
      label: "Credenciales GLPI",
      risk: glpi.configured ? "ok" : "warning",
    }),
    item(demoCleanupPostureFromEnv(process.env)),
  ];

  const summary = {
    configured: items.filter((entry) => entry.configured).length,
    critical: items.filter((entry) => entry.risk === "critical").length,
    total: items.length,
    warnings: items.filter((entry) => entry.risk === "warning").length,
  };

  return {
    items,
    mode: summary.critical || summary.warnings ? "needs_attention" : "ready",
    summary,
  };
}
