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

export function getAuthMode(): AuthMode {
  return process.env.NEXERA_AUTH_MODE === "production" ? "production" : "demo";
}

export function allowsDemoAuthFallback() {
  return getAuthMode() === "demo";
}
