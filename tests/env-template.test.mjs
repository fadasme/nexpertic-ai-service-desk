import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const demoTemplate = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const pilotTemplate = readFileSync(
  new URL("../.env.pilot.example", import.meta.url),
  "utf8",
);

const requiredPilotKeys = [
  "NEXERA_AUTH_MODE",
  "NEXERA_SEED_DEMO",
  "NEXERA_ALLOW_DEMO_CLEANUP",
  "NEXERA_SESSION_SECRET",
  "NEXERA_CONSENT_SECRET",
  "NEXERA_OIDC_STATE_SECRET",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_REDIRECT_URI",
  "GLPI_BASE_URL",
  "GLPI_APP_TOKEN",
  "GLPI_USER_TOKEN",
  "NEXERA_D1_DATABASE",
];

test("keeps the demo env template explicitly in safe demo mode", () => {
  assert.match(demoTemplate, /^NEXERA_AUTH_MODE=demo$/m);
  assert.match(demoTemplate, /^NEXERA_SEED_DEMO=true$/m);
  assert.match(demoTemplate, /^NEXERA_ALLOW_DEMO_CLEANUP=false$/m);
});

test("keeps the pilot env template production-safe by default", () => {
  assert.match(pilotTemplate, /^NEXERA_AUTH_MODE=production$/m);
  assert.match(pilotTemplate, /^NEXERA_SEED_DEMO=false$/m);
  assert.match(pilotTemplate, /^NEXERA_ALLOW_DEMO_CLEANUP=false$/m);
});

test("documents all required pilot integration and secret keys", () => {
  for (const key of requiredPilotKeys) {
    assert.match(pilotTemplate, new RegExp(`^${key}=`, "m"), `${key} is missing`);
  }
});

test("does not contain obvious committed real secret values", () => {
  const forbiddenExamples = [
    /^NEXERA_SESSION_SECRET=[A-Za-z0-9_-]{32,}$/m,
    /^NEXERA_CONSENT_SECRET=[A-Za-z0-9_-]{32,}$/m,
    /^NEXERA_OIDC_STATE_SECRET=[A-Za-z0-9_-]{32,}$/m,
  ];

  for (const pattern of forbiddenExamples) {
    assert.doesNotMatch(pilotTemplate, pattern);
  }
});
