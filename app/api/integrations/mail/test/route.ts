import { requirePermission } from "@/lib/nexera/auth-store";
import { sendMail } from "@/lib/nexera/mail-adapter";

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "audit:read");
  if (!authorization.allowed) return authorization.response;

  const body = (await request.json().catch(() => ({}))) as { to?: unknown };
  const to = typeof body.to === "string" ? body.to.trim() : authorization.session.email;
  if (!to.includes("@")) return Response.json({ error: "A valid recipient email is required" }, { status: 400 });

  try {
    const result = await sendMail({
      subject: "Prueba SMTP Nexpertic",
      text: "Este correo confirma que Nexpertic AI Service Desk puede enviar notificaciones por SMTP.",
      to,
    });

    return Response.json({ data: result }, { status: result.sent ? 200 : 503 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "SMTP test failed" }, { status: 502 });
  }
}
