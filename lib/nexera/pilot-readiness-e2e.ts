import type { PilotReadinessItem } from "./contracts";

type E2eReadinessEnv = {
  NEXERA_E2E_VALIDATED?: string;
  NEXERA_E2E_VALIDATED_AT?: string;
};

export function e2eReadinessFromEnv(env: E2eReadinessEnv): PilotReadinessItem {
  const e2eValidated = env.NEXERA_E2E_VALIDATED === "true";
  const e2eValidatedAt = env.NEXERA_E2E_VALIDATED_AT?.trim();

  return {
    action: "Ejecutar npm run e2e:local en ambiente de prueba y registrar NEXERA_E2E_VALIDATED=true.",
    detail: e2eValidated
      ? `Corrida E2E formal registrada${e2eValidatedAt ? ` en ${e2eValidatedAt}` : ""}.`
      : "Flujos internos validados por build y probes locales; falta corrida formal de piloto.",
    key: "e2e",
    label: "Pruebas end-to-end",
    owner: "DevOps",
    status: e2eValidated ? "ready" : "warning",
  };
}
