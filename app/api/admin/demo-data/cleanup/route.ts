import { requirePermission } from "@/lib/nexera/auth-store";
import { cleanupDemoData } from "@/lib/nexera/repositories";
import { canCleanupDemoData } from "@/lib/nexera/runtime-config";
import { createSecurityEvent } from "@/lib/nexera/security-event-store";

type CleanupBody = {
  confirm?: string;
};

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "user:update");
  if (!authorization.allowed) return authorization.response;

  if (!canCleanupDemoData()) {
    await createSecurityEvent({
      tenantId: authorization.session.tenantId,
      action: "Demo cleanup blocked",
      detail: `${authorization.session.name} attempted demo cleanup while NEXERA_ALLOW_DEMO_CLEANUP was disabled.`,
      fingerprint: authorization.session.id,
      severity: "warning",
      source: "admin",
    });
    return Response.json(
      {
        error: "Demo cleanup is disabled",
        requiredEnv: "NEXERA_ALLOW_DEMO_CLEANUP=true",
      },
      { status: 423 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as CleanupBody;

  if (body.confirm !== "DELETE_DEMO_DATA") {
    await createSecurityEvent({
      tenantId: authorization.session.tenantId,
      action: "Demo cleanup confirmation failed",
      detail: `${authorization.session.name} attempted demo cleanup without explicit confirmation.`,
      fingerprint: authorization.session.id,
      severity: "warning",
      source: "admin",
    });
    return Response.json(
      {
        error: "Explicit confirmation is required",
        requiredConfirmation: "DELETE_DEMO_DATA",
      },
      { status: 400 },
    );
  }

  const result = await cleanupDemoData();

  await createSecurityEvent({
    tenantId: authorization.session.tenantId,
    action: "Demo cleanup executed",
    detail: `${authorization.session.name} removed demo data: ${result.tickets} tickets, ${result.auditEvents} audit events, ${result.remoteSupportSessions} remote sessions, ${result.users} users.`,
    fingerprint: authorization.session.id,
    severity: "critical",
    source: "admin",
  });

  return Response.json({
    data: result,
    note: "Only known seeded demo tickets, their audit/remote sessions, and non-admin demo users were removed.",
  });
}
