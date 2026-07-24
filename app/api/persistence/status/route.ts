import { env } from "cloudflare:workers";
import { requirePermission } from "@/lib/nexera/auth-store";
import { getPersistenceSchemaStatus } from "@/lib/nexera/repositories";
import { canCleanupDemoData, getAuthMode, getSeedMode, shouldSeedDemoData } from "@/lib/nexera/runtime-config";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;
  const schema = await getPersistenceSchemaStatus();

  return Response.json({
    data: {
      binding: "DB",
      d1Available: Boolean(env.DB),
      mode: env.DB ? "d1-active" : "memory-fallback",
      authMode: getAuthMode(),
      repository: env.DB ? "d1-active-with-memory-fallback" : "memory-active",
      seedDemoData: shouldSeedDemoData(),
      seedMode: getSeedMode(),
      schema,
      demoCleanupEnabled: canCleanupDemoData(),
      persistedEntities: ["schema_migrations", "tickets", "audit_events", "remote_support_sessions", "security_events", "users", "tenants"],
      note: env.DB
        ? "Cloudflare D1 binding available. Repositories use D1 with automatic schema safety fallback."
        : "Cloudflare D1 binding unavailable. API remains on memory repository.",
    },
  });
}
