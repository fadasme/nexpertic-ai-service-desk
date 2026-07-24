import { ConsentDecision } from "../ConsentDecision";
import { headers } from "next/headers";

type ConsentPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="consentShell">
        <section className="consentCard">
          <p className="eyebrow">Autorizacion de soporte remoto</p>
          <h1>Token requerido</h1>
          <p>Abre el enlace de consentimiento enviado por soporte para aprobar o rechazar la sesion.</p>
        </section>
      </main>
    );
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/integrations/rustdesk/consent?token=${token}`, {
    cache: "no-store",
  }).catch(() => null);

  if (response?.status === 410) {
    const payload = (await response.json()) as { data: Parameters<typeof ConsentDecision>[0]["initialSession"] };
    return <ConsentDecision initialSession={payload.data} token={token} />;
  }

  if (!response?.ok) {
    return (
      <main className="consentShell">
        <section className="consentCard">
          <p className="eyebrow">Autorizacion de soporte remoto</p>
          <h1>Solicitud no encontrada</h1>
          <p>El enlace puede haber expirado, haber sido respondido o no existir.</p>
        </section>
      </main>
    );
  }

  const payload = (await response.json()) as { data: Parameters<typeof ConsentDecision>[0]["initialSession"] };

  return <ConsentDecision initialSession={payload.data} token={token} />;
}
