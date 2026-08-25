"use client";

import { useState, useTransition } from "react";
import type { IdentityProviderConfig, OidcJwksStatus, SessionUser, UserAccount } from "@/lib/nexera/contracts";

type SigninPanelProps = {
  authMode: "demo" | "production";
  oidcConfig: IdentityProviderConfig;
  oidcStatus: OidcJwksStatus;
  sessionLocked: boolean;
  returnTo: string;
  sessionTtlMinutes: number;
  users: UserAccount[];
};

export function SigninPanel({ authMode, returnTo, sessionLocked }: SigninPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const returnByRole: Record<string, string> = {
    Admin: "/admin",
    Analista: "/analista",
    Ejecutivo: "/ejecutivo",
    Usuario: "/usuario",
  };
  const accessButtonLabel = sessionLocked ? "Desbloquear con tu cuenta" : authMode === "production" ? "Continuar con tu cuenta" : "Entrar con cuenta demo";

  function signInWithOidc() {
    window.location.href = `/api/auth/oidc/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function signInWithLocalAdmin() {
    setAdminError("");
    setAdminSuccess("");
    startTransition(async () => {
      const response = await fetch("/api/auth/local-admin", {
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as { data?: SessionUser; error?: string };
      if (response.ok && payload.data) {
        setAdminSuccess("Acceso interno activado.");
        window.location.href = returnByRole[payload.data.role] ?? returnTo;
        return;
      }

      setAdminError(payload.error || "No se pudo abrir la sesión de admin.");
    });
  }

  return (
    <section className="signinGrid" aria-label="Ingreso a Nexpertic">
      <div className="signinCard signinSplit">
        <section className="signinBody">
          <div className="signinAuthBrand"><img alt="Nexpertic" src="/nexpertic-logo-transparent.png"/><span>AI SERVICE DESK</span></div>
          <p className="eyebrow">Iniciar sesión</p>
          <h2>Acceso principal</h2>
          <p className="signinLead">
            {sessionLocked
              ? "Vuelve a entrar con tu usuario y clave para desbloquear la plataforma."
              : "Usa tu cuenta de trabajo para continuar."}
          </p>

          <div className="signinActions">
            <button className="primary" disabled={isPending} onClick={signInWithOidc} type="button">
              {accessButtonLabel}
            </button>
          </div>

        </section>

        <aside className="signinDemo signinAdminBlock">
          <span>Acceso interno</span>
          <p className="permissionHint">Para administración interna puedes usar un usuario local con clave propia.</p>
          <div className="adminLoginForm">
            <label>
              <span>Correo</span>
              <input autoComplete="username" onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@nexera.local" type="email" value={adminEmail} />
            </label>
            <label>
              <span>Clave</span>
              <input autoComplete="current-password" onChange={(event) => setAdminPassword(event.target.value)} placeholder="Clave de admin" type="password" value={adminPassword} />
            </label>
            <button className="primary" disabled={isPending} onClick={signInWithLocalAdmin} type="button">
              {sessionLocked ? "Desbloquear con admin" : "Entrar como admin interno"}
            </button>
            {adminError ? <p className="permissionHint error">{adminError}</p> : null}
            {adminSuccess ? <p className="permissionHint success">{adminSuccess}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
