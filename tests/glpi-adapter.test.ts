import assert from "node:assert/strict";
import test from "node:test";
import { getGlpiStatus, pullTicketFromGlpi, syncTicketWithGlpi } from "../lib/nexera/glpi-adapter.ts";
import type { Ticket } from "../lib/nexera/contracts.ts";

const baseTicket: Ticket = {
  aiSummary: "Resumen IA del incidente.",
  category: "Infraestructura",
  confidence: 91,
  createdAt: "2026-07-23T12:00:00.000Z",
  externalRef: "Pendiente GLPI",
  id: "NX-1001",
  owner: "Mesa N1",
  priority: "Alta",
  requester: "usuario@nexpertic.test",
  sla: "En riesgo",
  source: "portal",
  status: "Nuevo",
  tenantId: "tenant-nexera-pilot",
  title: "VPN intermitente",
};

function clearGlpiEnv() {
  delete process.env.GLPI_BASE_URL;
  delete process.env.GLPI_APP_TOKEN;
  delete process.env.GLPI_USER_TOKEN;
  delete process.env.GLPI_TIMEOUT_MS;
  delete process.env.GLPI_MAX_RETRIES;
}

function configureGlpiEnv() {
  process.env.GLPI_BASE_URL = "https://glpi.example.test";
  process.env.GLPI_APP_TOKEN = "app-token";
  process.env.GLPI_USER_TOKEN = "user-token";
  process.env.GLPI_TIMEOUT_MS = "2000";
  process.env.GLPI_MAX_RETRIES = "1";
}

test("queues tickets when GLPI credentials are missing", async () => {
  clearGlpiEnv();

  const result = await syncTicketWithGlpi(baseTicket);

  assert.equal(result.mode, "not_configured");
  assert.equal(result.operation, "queue");
  assert.equal(result.status, "queued");
  assert.equal(result.externalRef, "GLPI-PENDING-1001");
});

test("creates a GLPI ticket and closes the session", async () => {
  configureGlpiEnv();
  const calls: Array<{ method: string; url: string }> = [];

  globalThis.fetch = async (input, init) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
    });

    if (String(input).endsWith("/initSession")) {
      return Response.json({ session_token: "session-token" });
    }
    if (String(input).endsWith("/Ticket")) {
      return Response.json({ id: 88231 });
    }
    if (String(input).endsWith("/killSession")) {
      return Response.json({});
    }

    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  const result = await syncTicketWithGlpi(baseTicket);

  assert.equal(result.mode, "configured");
  assert.equal(result.operation, "create");
  assert.equal(result.status, "synced");
  assert.equal(result.externalRef, "GLPI-88231");
  assert.equal(result.attempts, 1);
  assert.deepEqual(calls.map((call) => call.url), [
    "https://glpi.example.test/apirest.php/initSession",
    "https://glpi.example.test/apirest.php/Ticket",
    "https://glpi.example.test/apirest.php/killSession",
  ]);
});

test("retries transient GLPI failures before succeeding", async () => {
  configureGlpiEnv();
  let ticketAttempts = 0;

  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/initSession")) {
      return Response.json({ session_token: "session-token" });
    }
    if (String(input).endsWith("/Ticket")) {
      ticketAttempts += 1;
      if (ticketAttempts === 1) {
        return Response.json({ error: "busy" }, { status: 503 });
      }
      return Response.json({ id: 9001 });
    }
    if (String(input).endsWith("/killSession")) {
      return Response.json({});
    }

    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  const result = await syncTicketWithGlpi(baseTicket);

  assert.equal(result.status, "synced");
  assert.equal(result.externalRef, "GLPI-9001");
  assert.equal(result.attempts, 2);
  assert.equal(ticketAttempts, 2);
});

test("updates an existing GLPI ticket reference", async () => {
  configureGlpiEnv();
  const calls: string[] = [];

  globalThis.fetch = async (input) => {
    calls.push(String(input));

    if (String(input).endsWith("/initSession")) {
      return Response.json({ session_token: "session-token" });
    }
    if (String(input).endsWith("/Ticket/1234")) {
      return Response.json({});
    }
    if (String(input).endsWith("/killSession")) {
      return Response.json({});
    }

    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  const result = await syncTicketWithGlpi({
    ...baseTicket,
    externalRef: "GLPI-1234",
  });

  assert.equal(result.status, "synced");
  assert.equal(result.operation, "update");
  assert.equal(result.externalRef, "GLPI-1234");
  assert.ok(calls.includes("https://glpi.example.test/apirest.php/Ticket/1234"));
});

test("pulls mapped status and priority from GLPI", async () => {
  configureGlpiEnv();
  const calls: string[] = [];

  globalThis.fetch = async (input) => {
    calls.push(String(input));

    if (String(input).endsWith("/initSession")) {
      return Response.json({ session_token: "session-token" });
    }
    if (String(input).endsWith("/Ticket/777")) {
      return Response.json({
        id: 777,
        priority: 5,
        status: 4,
      });
    }
    if (String(input).endsWith("/killSession")) {
      return Response.json({});
    }

    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  const result = await pullTicketFromGlpi({
    ...baseTicket,
    externalRef: "GLPI-777",
  });

  assert.equal(result.status, "synced");
  assert.equal(result.operation, "pull");
  assert.equal(result.externalRef, "GLPI-777");
  assert.deepEqual(result.updates, {
    priority: "Critica",
    status: "Pendiente usuario",
  });
  assert.ok(calls.includes("https://glpi.example.test/apirest.php/Ticket/777"));
});

test("rejects GLPI pull when ticket has no valid external reference", async () => {
  configureGlpiEnv();

  const result = await pullTicketFromGlpi(baseTicket);

  assert.equal(result.status, "failed");
  assert.equal(result.operation, "pull");
  assert.match(result.message, /valid GLPI external reference/);
});

test("exposes sanitized GLPI readiness configuration", () => {
  configureGlpiEnv();

  assert.deepEqual(getGlpiStatus(), {
    configured: true,
    endpoints: ["initSession", "Ticket", "killSession"],
    maxRetries: 1,
    mode: "configured",
    requiredEnv: ["GLPI_BASE_URL", "GLPI_APP_TOKEN", "GLPI_USER_TOKEN"],
    timeoutMs: 2000,
  });
});
