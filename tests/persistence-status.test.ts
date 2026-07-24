import assert from "node:assert/strict";
import test from "node:test";
import { persistenceSchemaStatusFromRows } from "../lib/nexera/persistence-status.ts";

test("reports schema tracking unavailable when D1 binding is absent", async () => {
  const status = persistenceSchemaStatusFromRows([], true);

  assert.deepEqual(status, {
    appliedMigrations: [],
    schemaTracking: "unavailable",
  });
});

test("reports latest applied migration from sanitized rows", () => {
  const status = persistenceSchemaStatusFromRows([
    { id: "002-next" },
    { id: "001-initial-schema" },
  ]);

  assert.deepEqual(status, {
    appliedMigrations: ["002-next", "001-initial-schema"],
    latestMigration: "002-next",
    schemaTracking: "available",
  });
});

test("reports missing tracking when D1 returns no rows", () => {
  assert.deepEqual(persistenceSchemaStatusFromRows([]), {
    appliedMigrations: [],
    latestMigration: undefined,
    schemaTracking: "missing",
  });
});
