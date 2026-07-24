import type { SecretPostureItem } from "./contracts";

type DemoCleanupEnv = {
  NEXERA_ALLOW_DEMO_CLEANUP?: string;
};

export function demoCleanupPostureFromEnv(env: DemoCleanupEnv): SecretPostureItem {
  const cleanupEnabled = env.NEXERA_ALLOW_DEMO_CLEANUP === "true";

  return {
    configured: !cleanupEnabled,
    devFallback: cleanupEnabled,
    key: "NEXERA_ALLOW_DEMO_CLEANUP",
    label: cleanupEnabled ? "Limpieza demo habilitada" : "Limpieza demo deshabilitada",
    risk: cleanupEnabled ? "warning" : "ok",
  };
}
