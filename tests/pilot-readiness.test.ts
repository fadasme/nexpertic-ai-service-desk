import assert from "node:assert/strict";
import test from "node:test";
import { e2eReadinessFromEnv } from "../lib/nexera/pilot-readiness-e2e.ts";

test("keeps E2E readiness pending until formal evidence is registered", () => {
  const e2e = e2eReadinessFromEnv({});

  assert.equal(e2e.status, "warning");
  assert.match(e2e.detail, /falta corrida formal/i);
  assert.match(e2e.action, /NEXERA_E2E_VALIDATED=true/);
});

test("marks E2E readiness ready when evidence is registered", () => {
  const e2e = e2eReadinessFromEnv({
    NEXERA_E2E_VALIDATED: "true",
    NEXERA_E2E_VALIDATED_AT: "2026-07-23T12:00:00.000Z",
  });

  assert.equal(e2e.status, "ready");
  assert.match(e2e.detail, /2026-07-23T12:00:00.000Z/);
});
