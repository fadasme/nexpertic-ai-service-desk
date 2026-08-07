"use client";

import { useEffect, useMemo, useState } from "react";

type SessionExpiryTickerProps = {
  expiresAt?: string;
  className?: string;
  mode?: "badge" | "banner" | "modal";
  logoutUrl?: string;
  onExpired?: () => void;
};

export function SessionExpiryTicker({ className, expiresAt, mode = "badge", logoutUrl = "/api/auth/logout", onExpired }: SessionExpiryTickerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const state = useMemo(() => {
    if (!expiresAt) return null;

    const expiresAtMs = new Date(expiresAt).getTime();
    const diffMs = expiresAtMs - now;
    const expired = diffMs <= 0;
    const minutes = Math.max(0, Math.ceil(diffMs / 60000));
    const seconds = Math.max(0, Math.ceil(diffMs / 1000));

    return {
      expired,
      minutes,
      seconds,
    };
  }, [expiresAt, now]);

  useEffect(() => {
    if (!state?.expired) return;

    let cancelled = false;
    async function logoutExpiredSession() {
      try {
        await fetch(logoutUrl, { method: "POST" });
      } finally {
        if (!cancelled) {
          onExpired?.();
          window.location.reload();
        }
      }
    }

    void logoutExpiredSession();
    return () => {
      cancelled = true;
    };
  }, [logoutUrl, onExpired, state?.expired]);

  if (!state) return null;

  if (mode === "banner") {
    return (
      <div className={className ? `sessionExpiryBanner ${className}` : state.minutes <= 5 ? "sessionExpiryBanner danger" : "sessionExpiryBanner"}>
        <strong>{state.expired ? "Sesion expirada" : state.minutes <= 1 ? `Expira en ${state.seconds} s` : `Expira en ${state.minutes} min`}</strong>
        <span>
          {state.expired
            ? "Vuelve a iniciar sesion para recuperar acceso."
            : state.minutes <= 5
              ? "La sesion esta cerca de vencer. Guarda tu trabajo y renueva acceso."
              : "El temporizador se actualiza en vivo para avisar antes de expirar."}
        </span>
      </div>
    );
  }

  if (mode === "modal") {
    if (state.expired) {
      return (
        <div className="sessionExpiryModalBackdrop" role="alertdialog" aria-modal="true" aria-labelledby="session-expiry-title">
          <div className="sessionExpiryModal danger">
            <p className="eyebrow">Sesion expirada</p>
            <h3 id="session-expiry-title">Tu acceso vencio</h3>
            <p>Vuelve a iniciar sesion para seguir trabajando con trazabilidad y control de acceso.</p>
            <div className="sessionExpiryModalActions">
              <a className="buttonLike primary" href="/signin">
                Iniciar sesión
              </a>
              <button
                type="button"
                onClick={() => {
                  void fetch(logoutUrl, { method: "POST" }).finally(() => window.location.reload());
                }}
              >
                Refrescar acceso
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (state.minutes > 2) return null;

    return (
      <div className="sessionExpiryModalBackdrop" role="alertdialog" aria-modal="true" aria-labelledby="session-expiry-title">
        <div className={state.minutes <= 1 ? "sessionExpiryModal danger" : "sessionExpiryModal"}>
          <p className="eyebrow">Alerta de sesión</p>
          <h3 id="session-expiry-title">{state.minutes <= 1 ? `Queda menos de 1 minuto` : `Quedan ${state.minutes} minutos`}</h3>
          <p>
            {state.minutes <= 1
              ? `La sesión vence en ${state.seconds} segundos. Guarda tu trabajo y vuelve a iniciar acceso.`
              : "La sesión esta por vencer. Guarda tu trabajo y prepara un nuevo inicio de sesión."}
          </p>
          <div className="sessionExpiryModalActions">
            <a className="buttonLike primary" href="/signin">
              Reingresar
            </a>
            <button
              type="button"
              onClick={() => {
                void fetch(logoutUrl, { method: "POST" }).finally(() => window.location.reload());
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <span className={className ? `badge ${className}` : state.minutes <= 5 ? "badge danger" : "badge"}>
      {state.expired ? "Sesion expirada" : state.minutes <= 1 ? `Expira en ${state.seconds} s` : `Expira en ${state.minutes} min`}
    </span>
  );
}
