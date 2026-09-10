export function shouldSeedDemoData() {
  return process.env.NEXERA_SEED_DEMO !== "false";
}

export function getSeedMode() {
  return shouldSeedDemoData() ? "demo" : "production-clean";
}

export function canCleanupDemoData() {
  return process.env.NEXERA_ALLOW_DEMO_CLEANUP === "true";
}

export type AuthMode = "demo" | "production";

export function hasConfiguredEnvValue(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return false;
  if (/^<.+>$/.test(normalized)) return false;
  if (normalized.includes("example.com")) return false;
  if (normalized.includes("replace-with-")) return false;
  if (normalized.includes("generate-")) return false;
  return true;
}

export function getAuthMode(): AuthMode {
  return process.env.NEXERA_AUTH_MODE === "production" ? "production" : "demo";
}

export function allowsDemoAuthFallback() {
  return getAuthMode() === "demo";
}

export function getDefaultSessionTtlMinutes() {
  return getAuthMode() === "production" ? 8 * 60 : 120;
}

export function getLocalAdminCredentials() {
  const email = (process.env.NEXERA_LOCAL_ADMIN_EMAIL ?? "soporte@nexera.cl").trim();
  const password = (process.env.NEXERA_LOCAL_ADMIN_PASSWORD ?? "").trim();

  return {
    email,
    enabled: hasConfiguredEnvValue(email) && hasConfiguredEnvValue(password),
    password,
  };
}
