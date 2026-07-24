const baseUrl = process.env.NEXPERTIC_E2E_BASE_URL ?? "http://localhost:3000";
const tenantId = "tenant-nexera-pilot";

const checks = [];

function expect(name, condition, detail = "") {
  checks.push({ detail, name, ok: Boolean(condition) });
}

function headers(role, extra = {}) {
  return {
    "content-type": "application/json",
    "x-nexera-role": role,
    "x-nexera-tenant": tenantId,
    ...extra,
  };
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { body, response };
}

async function main() {
  const runId = Date.now();

  const health = await json("/api/health");
  expect("health responds", health.response.status === 200, `HTTP ${health.response.status}`);
  expect("product is Nexpertic", health.body.product === "Nexpertic AI Service Desk", health.body.product);

  const userSession = await json("/api/auth/session", {
    body: JSON.stringify({ userId: "usr-demo" }),
    headers: headers("Usuario"),
    method: "POST",
  });
  const userCookie = userSession.response.headers.get("set-cookie")?.split(";")[0];
  expect("Usuario session cookie created", userSession.response.status === 200 && Boolean(userCookie), `HTTP ${userSession.response.status}`);

  const createTicket = await json("/api/tickets", {
    body: JSON.stringify({
      description: `E2E ${runId}: usuario no puede acceder a VPN corporativa despues de cambio MFA`,
      requester: `e2e-${runId}@nexpertic.test`,
      source: "portal",
    }),
    headers: { cookie: userCookie ?? "", "content-type": "application/json" },
    method: "POST",
  });
  const ticket = createTicket.body.data;
  expect("Usuario creates ticket", createTicket.response.status === 201 && ticket?.id, `HTTP ${createTicket.response.status}`);
  expect("Usuario ticket requester is session-bound", ticket?.requester === "usuario@nexera.demo", ticket?.requester);

  const analystSession = await json("/api/auth/session", {
    body: JSON.stringify({ userId: "ana-demo" }),
    headers: headers("Analista"),
    method: "POST",
  });
  const analystCookie = analystSession.response.headers.get("set-cookie")?.split(";")[0];
  expect("Analista session cookie created", analystSession.response.status === 200 && Boolean(analystCookie), `HTTP ${analystSession.response.status}`);

  const queue = await json(`/api/tickets?q=${encodeURIComponent(ticket?.id ?? "")}`, {
    headers: { cookie: analystCookie ?? "" },
  });
  expect("Analista reads created ticket", queue.response.status === 200 && queue.body.data?.some((item) => item.id === ticket.id), `HTTP ${queue.response.status}`);

  const glpiSync = await json("/api/integrations/glpi/sync", {
    body: JSON.stringify({ ticketId: ticket.id }),
    headers: { cookie: analystCookie ?? "", "content-type": "application/json" },
    method: "POST",
  });
  const glpiTicket = glpiSync.body.data;
  expect("Analista syncs GLPI or queues fallback", glpiSync.response.status === 200 && glpiTicket?.externalRef?.startsWith("GLPI-"), `HTTP ${glpiSync.response.status}`);

  const remoteCreate = await json("/api/integrations/rustdesk/session", {
    body: JSON.stringify({ ticketId: ticket.id }),
    headers: { cookie: analystCookie ?? "", "content-type": "application/json" },
    method: "POST",
  });
  const remoteSession = remoteCreate.body.data;
  expect("Analista creates RustDesk session", remoteCreate.response.status === 200 && remoteSession?.consentToken, `HTTP ${remoteCreate.response.status}`);

  const connectBeforeConsent = await json("/api/integrations/rustdesk/session", {
    body: JSON.stringify({ id: remoteSession?.id, status: "Conectado" }),
    headers: { cookie: analystCookie ?? "", "content-type": "application/json" },
    method: "PATCH",
  });
  expect("RustDesk blocks connection before consent", connectBeforeConsent.response.status === 409, `HTTP ${connectBeforeConsent.response.status}`);

  const consentLookup = await json(`/api/integrations/rustdesk/consent?token=${encodeURIComponent(remoteSession?.consentToken ?? "")}`);
  expect("User can open consent request", consentLookup.response.status === 200 && consentLookup.body.data?.ticketId === ticket.id, `HTTP ${consentLookup.response.status}`);

  const consentApprove = await json("/api/integrations/rustdesk/consent", {
    body: JSON.stringify({ decision: "approve", token: remoteSession?.consentToken }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect("User approves RustDesk consent", consentApprove.response.status === 200 && consentApprove.body.data?.consentGrantedAt, `HTTP ${consentApprove.response.status}`);

  const connectAfterConsent = await json("/api/integrations/rustdesk/session", {
    body: JSON.stringify({ id: remoteSession?.id, status: "Conectado" }),
    headers: { cookie: analystCookie ?? "", "content-type": "application/json" },
    method: "PATCH",
  });
  expect("RustDesk connects after consent", connectAfterConsent.response.status === 200 && connectAfterConsent.body.data?.status === "Conectado", `HTTP ${connectAfterConsent.response.status}`);

  const audit = await json(`/api/audit?ticketId=${encodeURIComponent(ticket.id)}`, {
    headers: { cookie: analystCookie ?? "" },
  });
  expect("Audit records ticket flow", audit.response.status === 200 && audit.body.data?.length >= 1, `HTTP ${audit.response.status}`);
  expect(
    "Audit includes RustDesk consent",
    audit.body.data?.some((event) => event.action === "Consentimiento RustDesk aprobado"),
    "consent audit event present",
  );
  expect(
    "Audit includes RAG suggestion",
    audit.body.data?.some((event) => event.action === "Knowledge sugerido" && event.detail.includes("KB-001")),
    "knowledge suggestion audit present",
  );

  const readiness = await json("/api/pilot/readiness", {
    headers: { cookie: analystCookie ?? "" },
  });
  expect("Pilot readiness endpoint responds", readiness.response.status === 200 && readiness.body.data?.mode, `HTTP ${readiness.response.status}`);

  const persistence = await json("/api/persistence/status", {
    headers: { cookie: analystCookie ?? "" },
  });
  expect("Persistence status is protected and readable", persistence.response.status === 200 && persistence.body.data?.repository, `HTTP ${persistence.response.status}`);

  const failures = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} E2E check(s) failed against ${baseUrl}`);
    process.exit(1);
  }

  const completedAt = new Date().toISOString();
  console.log(`\n${checks.length} E2E checks passed against ${baseUrl}`);
  console.log("\nReadiness evidence:");
  console.log("NEXERA_E2E_VALIDATED=true");
  console.log(`NEXERA_E2E_VALIDATED_AT=${completedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
