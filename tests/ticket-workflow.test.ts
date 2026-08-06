import assert from "node:assert/strict";
import test from "node:test";
import { isValidTicketTransition, suggestNextTicketStep } from "../lib/nexera/ticket-workflow.ts";

test("suggests the first lifecycle step for a new ticket", () => {
  const step = suggestNextTicketStep({
    id: "NX-1",
    externalRef: "Pendiente GLPI",
    title: "Test",
    requester: "Usuario",
    priority: "Media",
    status: "Nuevo",
    owner: "Mesa L1",
    category: "General",
    confidence: 70,
    aiSummary: "Resumen",
    sla: "Normal",
    source: "chat",
    createdAt: new Date().toISOString(),
  });

  assert.equal(step?.label, "Asignar L1");
  assert.equal(step?.status, "Asignado");
});

test("blocks invalid transitions", () => {
  assert.equal(isValidTicketTransition("Nuevo", "Resuelto"), false);
  assert.equal(isValidTicketTransition("En diagnostico", "Resuelto"), true);
});
