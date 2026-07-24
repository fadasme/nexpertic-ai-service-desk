import { isDevConsentSecret } from "./consent-token";
import type { PilotReadiness, PilotReadinessItem } from "./contracts";
import { getGlpiStatus } from "./glpi-adapter";
import { getOidcConfig, isDevOidcStateSecret } from "./oidc-config";
import { e2eReadinessFromEnv } from "./pilot-readiness-e2e";
import { getAuthMode, getSeedMode, shouldSeedDemoData } from "./runtime-config";
import { isDevSessionSecret } from "./session-cookie";

function readinessItem(item: PilotReadinessItem): PilotReadinessItem {
  return item;
}

export function getPilotReadiness(): PilotReadiness {
  const authMode = getAuthMode();
  const seedMode = getSeedMode();
  const glpi = getGlpiStatus();
  const oidc = getOidcConfig();
  const sessionSecretDev = isDevSessionSecret();
  const consentSecretDev = isDevConsentSecret();
  const oidcStateSecretDev = isDevOidcStateSecret();

  const items = [
    readinessItem({
      action: "Configurar NEXERA_AUTH_MODE=production antes de ambiente cliente.",
      detail: authMode === "production" ? "Headers demo apagados." : "La instancia aun acepta headers de prueba.",
      key: "auth-mode",
      label: "Auth production mode",
      owner: "Seguridad",
      status: authMode === "production" ? "ready" : "blocker",
    }),
    readinessItem({
      action: "Definir NEXERA_SESSION_SECRET con valor largo y unico.",
      detail: sessionSecretDev ? "Cookie de sesion usa secreto de desarrollo." : "Cookie de sesion firmada con secreto configurado.",
      key: "session-secret",
      label: "Secreto de sesion",
      owner: "Seguridad",
      status: sessionSecretDev ? "blocker" : "ready",
    }),
    readinessItem({
      action: "Definir NEXERA_CONSENT_SECRET con valor largo y unico.",
      detail: consentSecretDev ? "Consentimiento RustDesk usa secreto de desarrollo." : "Consentimiento RustDesk firmado con secreto configurado.",
      key: "consent-secret",
      label: "Secreto RustDesk",
      owner: "Seguridad",
      status: consentSecretDev ? "blocker" : "ready",
    }),
    readinessItem({
      action: "Definir NEXERA_OIDC_STATE_SECRET con valor largo y unico.",
      detail: oidcStateSecretDev ? "State OIDC usa secreto de desarrollo." : "State OIDC firmado con secreto configurado.",
      key: "oidc-state-secret",
      label: "Secreto state OIDC",
      owner: "Seguridad",
      status: oidcStateSecretDev ? "blocker" : "ready",
    }),
    readinessItem({
      action: "Configurar GLPI_BASE_URL, GLPI_APP_TOKEN y GLPI_USER_TOKEN.",
      detail: glpi.configured ? "Adapter GLPI configurado." : "GLPI opera en cola/fallback.",
      key: "glpi",
      label: "GLPI real",
      owner: "Arquitectura",
      status: glpi.configured ? "ready" : "blocker",
    }),
    readinessItem({
      action: "Configurar OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET y OIDC_REDIRECT_URI.",
      detail: oidc.mode === "configured" ? `${oidc.provider} configurado.` : "SSO aun no esta configurado completamente.",
      key: "oidc",
      label: "SSO OIDC",
      owner: "Seguridad",
      status: oidc.mode === "configured" ? "warning" : "blocker",
    }),
    readinessItem({
      action: "Usar NEXERA_SEED_DEMO=false y ejecutar limpieza controlada si corresponde.",
      detail: shouldSeedDemoData() ? "Datos demo siguen habilitados." : `Seed mode ${seedMode}.`,
      key: "demo-data",
      label: "Datos demo apagados",
      owner: "Producto",
      status: shouldSeedDemoData() ? "warning" : "ready",
    }),
    e2eReadinessFromEnv(process.env),
  ];

  const summary = {
    blockers: items.filter((item) => item.status === "blocker").length,
    ready: items.filter((item) => item.status === "ready").length,
    total: items.length,
    warnings: items.filter((item) => item.status === "warning").length,
  };
  const score = Math.round(((summary.ready + summary.warnings * 0.5) / summary.total) * 100);
  const nextActions = items.filter((item) => item.status !== "ready").map((item) => item.action).slice(0, 4);

  return {
    items,
    mode: summary.blockers ? "pilot_blocked" : summary.warnings ? "demo_ready" : "pilot_ready",
    nextActions,
    score,
    summary,
  };
}
