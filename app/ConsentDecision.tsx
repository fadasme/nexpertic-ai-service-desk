"use client";

import { useEffect, useState, useTransition } from "react";

type ConsentSession = {
  code: string;
  consentExpiresAt: string;
  consentGrantedAt?: string;
  consentRejectedAt?: string;
  expiresInMinutes: number;
  provider: "RustDesk";
  status: string;
  ticketId: string;
};

type ConsentDecisionProps = {
  initialSession: ConsentSession;
  token: string;
};

function isoTime(value: string) {
  return `${value.slice(11, 16)} UTC`;
}

export function ConsentDecision({ initialSession, token }: ConsentDecisionProps) {
  const [session, setSession] = useState(initialSession);
  const [message, setMessage] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isPending, startTransition] = useTransition();
  const alreadyAnswered = Boolean(session.consentGrantedAt || session.consentRejectedAt);
  const actionsDisabled = alreadyAnswered || isExpired || isPending;

  useEffect(() => {
    setIsExpired(Date.now() > new Date(session.consentExpiresAt).getTime());
  }, [session.consentExpiresAt]);

  function decide(decision: "approve" | "reject") {
    startTransition(async () => {
      const response = await fetch("/api/integrations/rustdesk/consent", {
        body: JSON.stringify({ decision, token }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { data?: ConsentSession; error?: string };

      if (payload.data) {
        setSession(payload.data);
        if (!response.ok) {
          setMessage(payload.error ?? "No se pudo registrar la decision.");
          return;
        }
        setMessage(decision === "approve" ? "Consentimiento aprobado. El analista ya puede conectar." : "Consentimiento rechazado. La sesion no podra conectarse.");
        return;
      }

      setMessage(payload.error ?? "No se pudo registrar la decision.");
    });
  }

  return (
    <div className="consentShell">
      <section className="consentCard">
        <p className="eyebrow">Autorizacion de soporte remoto</p>
        <h1>Solicitud {session.code}</h1>
        <p>
          Un analista solicita iniciar una sesion {session.provider} asociada al ticket {session.ticketId}. Aprueba solo si reconoces esta solicitud.
        </p>
        <div className="consentFacts">
          <span>Estado: {session.status}</span>
          <span>Expira en {session.expiresInMinutes} minutos</span>
          <span>Valido hasta {isoTime(session.consentExpiresAt)}</span>
          <span>{session.consentGrantedAt ? "Aprobada" : session.consentRejectedAt ? "Rechazada" : "Pendiente"}</span>
        </div>
        <div className="consentActions">
          <button className="primary" disabled={actionsDisabled} onClick={() => decide("approve")} type="button">
            Aprobar soporte remoto
          </button>
          <button disabled={actionsDisabled} onClick={() => decide("reject")} type="button">
            Rechazar
          </button>
        </div>
        {isExpired && !alreadyAnswered ? <p className="permissionHint">Este enlace de consentimiento expiro. Solicita una nueva invitacion a soporte.</p> : null}
        {message ? <p className="permissionHint">{message}</p> : null}
      </section>
    </div>
  );
}
