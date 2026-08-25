import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/nexera/auth-store";
import { listAuditEvents } from "@/lib/nexera/audit-store";
import type { SessionUser } from "@/lib/nexera/contracts";
import { listRemoteSupportSessions } from "@/lib/nexera/remote-support-store";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { listKnowledgeArticles } from "@/lib/nexera/service";
import { sessionCookieName, sessionLockCookieName, verifySessionCookie, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listStoredTickets } from "@/lib/nexera/ticket-store";
import { NexperticWorkspace } from "./NexperticWorkspace";

type WorkspaceView = "dashboard" | "tickets" | "reports" | "admin";

export async function WorkspacePage({ initialView, returnTo, role }: {
  initialView: WorkspaceView;
  returnTo: string;
  role: SessionUser["role"];
}) {
  const cookieStore = await cookies();
  const signedSession = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);

  if (sessionLock) redirect(`/signin?returnTo=${returnTo}&mode=unlock`);
  if (getAuthMode() === "production" && !signedSession) redirect(`/signin?returnTo=${returnTo}`);

  const tenantId = signedSession?.tenantId ?? DEFAULT_TENANT_ID;
  const [tickets, auditEvents, remoteSessions] = await Promise.all([
    listStoredTickets({ tenantId }),
    listAuditEvents(undefined, tenantId),
    listRemoteSupportSessions(undefined, tenantId),
  ]);

  return <NexperticWorkspace
    initialAuditEvents={auditEvents}
    initialKnowledgeArticles={listKnowledgeArticles()}
    initialRemoteSessions={remoteSessions}
    initialSession={signedSession ?? getSession(role)}
    initialTickets={tickets}
    initialView={initialView}
  />;
}
