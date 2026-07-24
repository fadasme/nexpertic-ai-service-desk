const baseUrl = process.env.NEXPERTIC_SMOKE_BASE_URL ?? "http://localhost:3000";

const checks = [];

function expect(name, condition, detail = "") {
  checks.push({ detail, name, ok: Boolean(condition) });
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { body, response };
}

async function main() {
  const adminHeaders = { "x-nexera-role": "Admin", "x-nexera-tenant": "tenant-nexera-pilot" };
  const analystHeaders = { "x-nexera-role": "Analista", "x-nexera-tenant": "tenant-nexera-pilot" };
  const userHeaders = { "x-nexera-role": "Usuario", "x-nexera-tenant": "tenant-nexera-pilot" };
  const wrongTenantHeaders = { "x-nexera-role": "Admin", "x-nexera-tenant": "tenant-acme-test" };

  const health = await json("/api/health");
  expect("health is public", health.response.status === 200, `HTTP ${health.response.status}`);
  expect("brand is Nexpertic", health.body.product === "Nexpertic AI Service Desk", health.body.product);

  const session = await json("/api/auth/session", {
    body: JSON.stringify({ userId: "admin-demo" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const cookie = session.response.headers.get("set-cookie")?.split(";")[0];
  expect("demo session returns signed cookie", session.response.status === 200 && Boolean(cookie), `HTTP ${session.response.status}`);

  const usersWithCookie = await json("/api/users", { headers: { cookie: cookie ?? "" } });
  expect("signed cookie authorizes users", usersWithCookie.response.status === 200, `HTTP ${usersWithCookie.response.status}`);

  const ticketsAsUser = await json("/api/tickets", { headers: userHeaders });
  expect("Usuario can list only own ticket queue", ticketsAsUser.response.status === 200 && Array.isArray(ticketsAsUser.body.data), `HTTP ${ticketsAsUser.response.status}`);
  expect(
    "Usuario ticket queue is requester scoped",
    ticketsAsUser.body.data?.every((ticket) => ticket.requester === "usuario@nexera.demo") === true,
    "all returned tickets belong to usuario@nexera.demo",
  );

  const ticketsAsAnalyst = await json("/api/tickets", { headers: analystHeaders });
  expect("Analista can list ticket queue", ticketsAsAnalyst.response.status === 200 && Array.isArray(ticketsAsAnalyst.body.data), `HTTP ${ticketsAsAnalyst.response.status}`);

  const tenantsWrong = await json("/api/tenants", { headers: wrongTenantHeaders });
  expect("tenant catalog is scoped", tenantsWrong.response.status === 200 && tenantsWrong.body.data?.length === 0, `HTTP ${tenantsWrong.response.status}`);

  const readiness = await json("/api/pilot/readiness", { headers: analystHeaders });
  expect("pilot readiness is protected and readable by analyst", readiness.response.status === 200 && readiness.body.data?.mode, `HTTP ${readiness.response.status}`);

  const glpiStatusAsUser = await json("/api/integrations/glpi/status", { headers: userHeaders });
  expect("Usuario cannot read GLPI diagnostics", glpiStatusAsUser.response.status === 403, `HTTP ${glpiStatusAsUser.response.status}`);

  const glpiStatus = await json("/api/integrations/glpi/status", { headers: analystHeaders });
  expect("GLPI status is readable by analyst", glpiStatus.response.status === 200 && glpiStatus.body.data?.mode, `HTTP ${glpiStatus.response.status}`);

  const oidcStatusAsUser = await json("/api/auth/oidc/status", { headers: userHeaders });
  expect("Usuario cannot read OIDC diagnostics", oidcStatusAsUser.response.status === 403, `HTTP ${oidcStatusAsUser.response.status}`);

  const oidcStatus = await json("/api/auth/oidc/status", { headers: analystHeaders });
  expect("OIDC status is readable by analyst", oidcStatus.response.status === 200 && oidcStatus.body.data?.mode, `HTTP ${oidcStatus.response.status}`);

  const jwksStatusAsUser = await json("/api/auth/oidc/jwks/status", { headers: userHeaders });
  expect("Usuario cannot read OIDC JWKS diagnostics", jwksStatusAsUser.response.status === 403, `HTTP ${jwksStatusAsUser.response.status}`);

  const jwksStatus = await json("/api/auth/oidc/jwks/status", { headers: analystHeaders });
  expect("OIDC JWKS status is readable by analyst", jwksStatus.response.status === 200 && typeof jwksStatus.body.data?.jwksAvailable === "boolean", `HTTP ${jwksStatus.response.status}`);

  const rustdeskWrongTenant = await json("/api/integrations/rustdesk/session", {
    body: JSON.stringify({ ticketId: "NX-1042" }),
    headers: { ...wrongTenantHeaders, "content-type": "application/json" },
    method: "POST",
  });
  expect("RustDesk session rejects cross-tenant ticket", rustdeskWrongTenant.response.status === 404, `HTTP ${rustdeskWrongTenant.response.status}`);

  const knowledge = await json("/api/knowledge", { headers: userHeaders });
  expect("Usuario can read knowledge", knowledge.response.status === 200 && Array.isArray(knowledge.body.data), `HTTP ${knowledge.response.status}`);

  const knowledgeSearch = await json("/api/knowledge?q=vpn", { headers: userHeaders });
  expect("Usuario can search knowledge", knowledgeSearch.response.status === 200 && knowledgeSearch.body.data?.[0]?.id === "KB-001", `HTTP ${knowledgeSearch.response.status}`);

  const agents = await json("/api/agents", { headers: userHeaders });
  expect("Usuario cannot read agent internals", agents.response.status === 403, `HTTP ${agents.response.status}`);

  const failures = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} smoke check(s) failed against ${baseUrl}`);
    process.exit(1);
  }

  console.log(`\n${checks.length} smoke checks passed against ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
