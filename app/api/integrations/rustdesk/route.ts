import { requirePermission } from "@/lib/nexera/auth-store";
import { listRemoteSupportConnectors } from "@/lib/nexera/service";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "rustdesk:read");
  if (!authorization.allowed) return authorization.response;

  return Response.json({
    data: listRemoteSupportConnectors(),
    recommendation:
      "Usar RustDesk Server Pro para clientes enterprise que requieran API, OIDC, LDAP, 2FA y administracion centralizada. Usar OSS self-hosted para pilotos controlados con ID/relay propio.",
  });
}
