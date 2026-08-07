import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { getOidcConfig, getOidcJwksStatus } from "@/lib/nexera/oidc-config";
import { getSessionTtlMinutes, sessionCookieName, sessionLockCookieName, verifySessionCookie, verifySessionLockCookie } from "@/lib/nexera/session-cookie";
import { DEFAULT_TENANT_ID } from "@/lib/nexera/tenant-context";
import { listUserAccounts } from "@/lib/nexera/user-store";
import { SigninPanel } from "../SigninPanel";

type SigninPageProps = {
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function SigninPage({ searchParams }: SigninPageProps) {
  const params = await searchParams;
  const { returnTo } = params;
  const mode = typeof params.mode === "string" ? params.mode : undefined;
  const target = safeReturnTo(returnTo);
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);
  const sessionLock = await verifySessionLockCookie(cookieStore.get(sessionLockCookieName())?.value);

  if (session && !sessionLock) {
    redirect(target);
  }

  const users = await listUserAccounts(DEFAULT_TENANT_ID);
  const authMode = getAuthMode();
  const oidcConfig = getOidcConfig();
  const oidcStatus = await getOidcJwksStatus();

  return (
    <SigninPanel
      authMode={authMode}
      oidcConfig={oidcConfig}
      oidcStatus={oidcStatus}
      returnTo={target}
      sessionLocked={Boolean(sessionLock) || mode === "unlock"}
      sessionTtlMinutes={getSessionTtlMinutes()}
      users={users}
    />
  );
}
