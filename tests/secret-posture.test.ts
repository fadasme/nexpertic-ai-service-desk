import assert from "node:assert/strict";
import test from "node:test";
import { demoCleanupPostureFromEnv } from "../lib/nexera/secret-posture-demo-cleanup.ts";

test("marks demo cleanup disabled as the safe posture", () => {
  assert.deepEqual(demoCleanupPostureFromEnv({ NEXERA_ALLOW_DEMO_CLEANUP: "false" }), {
    configured: true,
    devFallback: false,
    key: "NEXERA_ALLOW_DEMO_CLEANUP",
    label: "Limpieza demo deshabilitada",
    risk: "ok",
  });
});

test("warns when demo cleanup remains enabled", () => {
  assert.deepEqual(demoCleanupPostureFromEnv({ NEXERA_ALLOW_DEMO_CLEANUP: "true" }), {
    configured: false,
    devFallback: true,
    key: "NEXERA_ALLOW_DEMO_CLEANUP",
    label: "Limpieza demo habilitada",
    risk: "warning",
  });
});
