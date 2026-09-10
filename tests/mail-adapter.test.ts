import assert from "node:assert/strict";
import test from "node:test";
import { getMailStatus } from "../lib/nexera/mail-adapter.ts";

function clearMailEnv() {
  delete process.env.SMTP_FROM;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
}

test("reports SMTP as missing without cPanel credentials", () => {
  clearMailEnv();

  const status = getMailStatus();

  assert.equal(status.configured, false);
  assert.equal(status.mode, "not_configured");
  assert.equal(status.sender, undefined);
});

test("does not treat SMTP placeholders as configured", () => {
  process.env.SMTP_FROM = "soporte@nexera.cl";
  process.env.SMTP_HOST = "mail.nexera.cl";
  process.env.SMTP_PASSWORD = "<smtp-password>";
  process.env.SMTP_USER = "soporte@nexera.cl";

  const status = getMailStatus();

  assert.equal(status.configured, false);
  assert.equal(status.mode, "not_configured");
  assert.equal(status.sender, "soporte@nexera.cl");
});

test("reports SMTP configured with complete cPanel values", () => {
  process.env.SMTP_FROM = "soporte@nexera.cl";
  process.env.SMTP_HOST = "mail.nexera.cl";
  process.env.SMTP_PASSWORD = "configured-test-password";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "soporte@nexera.cl";

  const status = getMailStatus();

  assert.equal(status.configured, true);
  assert.equal(status.mode, "configured");
  assert.equal(status.sender, "soporte@nexera.cl");
});
