import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, sessionLockCookieName, verifySessionCookie, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { WorkspacePage } from "./WorkspacePage";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);

  if (!session || sessionLock) {
    redirect("/signin?returnTo=/");
  }

  return <WorkspacePage initialView="dashboard" role="Usuario" returnTo="/" />;
}
