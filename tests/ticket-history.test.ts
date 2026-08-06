import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTicketChanges } from "../lib/nexera/ticket-history.ts";
import type { Ticket } from "../lib/nexera/contracts.ts";

const previous: Ticket = {
  aiSummary: "Resumen",
  category: "General",
  confidence: 70,
  createdAt: "2026-07-23T12:00:00.000Z",
  externalRef: "Pendiente GLPI",
  id: "NX-1",
  owner: "Mesa L1",
  priority: "Media",
  requester: "Usuario",
  sla: "Normal",
  source: "chat",
  status: "Nuevo",
  tenantId: "tenant-nexera-pilot",
  title: "Test",
};

test("summarizes ticket changes with before and after values", () => {
  const detail = summarizeTicketChanges(previous, {
    ...previous,
    externalRef: "GLPI-9999",
    owner: "Especialista L2",
    priority: "Alta",
    status: "Asignado",
  });

  assert.equal(
    detail,
    "Estado Nuevo -> Asignado · Responsable Mesa L1 -> Especialista L2 · Prioridad Media -> Alta · GLPI Pendiente GLPI -> GLPI-9999",
  );
});

test("returns a no-op message when nothing changes", () => {
  assert.equal(summarizeTicketChanges(previous, previous), "Sin cambios funcionales.");
});
