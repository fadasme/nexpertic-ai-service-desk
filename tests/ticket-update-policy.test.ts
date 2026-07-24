import assert from "node:assert/strict";
import test from "node:test";
import { hasTicketUpdate, sanitizeTicketUpdate } from "../lib/nexera/ticket-update-policy.ts";

test("keeps only allowed ticket update fields", () => {
  assert.deepEqual(
    sanitizeTicketUpdate({
      externalRef: " GLPI-123 ",
      owner: " Mesa L2 ",
      priority: "Alta",
      requester: "attacker@nexpertic.test",
      status: "Escalado",
      tenantId: "tenant-other",
      title: "mutated",
    }),
    {
      externalRef: "GLPI-123",
      owner: "Mesa L2",
      priority: "Alta",
      status: "Escalado",
    },
  );
});

test("rejects invalid ticket status and priority values", () => {
  const update = sanitizeTicketUpdate({
    priority: "Urgente",
    status: "Borrado",
  });

  assert.deepEqual(update, {});
  assert.equal(hasTicketUpdate(update), false);
});
