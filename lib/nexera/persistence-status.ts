export type PersistenceSchemaStatus = {
  appliedMigrations: string[];
  latestMigration?: string;
  schemaTracking: "available" | "missing" | "unavailable";
};

export function persistenceSchemaStatusFromRows(rows: Array<{ id: string }>, unavailable = false): PersistenceSchemaStatus {
  if (unavailable) {
    return {
      appliedMigrations: [],
      schemaTracking: "unavailable",
    };
  }

  const appliedMigrations = rows.map((row) => row.id);
  return {
    appliedMigrations,
    latestMigration: appliedMigrations[0],
    schemaTracking: appliedMigrations.length ? "available" : "missing",
  };
}
