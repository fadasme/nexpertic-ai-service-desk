import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthMode } from "@/lib/nexera/runtime-config";
import { verifySessionCookie, sessionCookieName } from "@/lib/nexera/session-cookie";
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
  const { returnTo } = await searchParams;
  const target = safeReturnTo(returnTo);
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get(sessionCookieName())?.value);

  if (session) {
    redirect(target);
  }

  const users = await listUserAccounts(DEFAULT_TENANT_ID);
  const authMode = getAuthMode();

  return <SigninPanel authMode={authMode} returnTo={target} users={users} />;
}
