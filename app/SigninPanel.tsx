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

export function SigninPanel({ authMode, oidcConfig, oidcStatus, returnTo, sessionLocked, sessionTtlMinutes, users }: SigninPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const demoUsers = users.filter((user) => ["Usuario", "Analista", "Ejecutivo", "Admin"].includes(user.role));
  const returnByRole: Record<string, string> = {
    Admin: "/admin",
    Analista: "/analista",
    Ejecutivo: "/ejecutivo",
    Usuario: "/usuario",
  };
  const accessLabel = sessionLocked ? "Sesión bloqueada" : authMode === "production" ? "Acceso corporativo" : "Acceso demo";
  const accessButtonLabel = sessionLocked ? "Desbloquear con tu cuenta" : authMode === "production" ? "Continuar con tu cuenta" : "Entrar con cuenta demo";

  function signInWithOidc() {
    window.location.href = `/api/auth/oidc/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function signInWithDemoUser(userId: string) {
    startTransition(async () => {
      const response = await fetch("/api/auth/session", {
        body: JSON.stringify({ userId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as { data?: SessionUser };
      if (response.ok && payload.data) {
        window.location.href = returnByRole[payload.data.role] ?? returnTo;
      }
    });
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
      <header className="landingHero signinHero">
        <div className="portalHeaderCopy">
          <div className="signinBrand"><span className="signinBrandMark">N</span><span><strong>NEXPERTIC</strong><small>AI SERVICE DESK</small></span></div>
          <p className="eyebrow">Workspace operativo</p>
          <h1>Tu mesa de servicio, lista.</h1>
          <p className="signinLead">
            {sessionLocked
              ? "Tu sesión quedó bloqueada. Vuelve a entrar con tu usuario y clave para recuperar el acceso."
              : "Ingresa con tu cuenta para continuar al panel operativo y mantener el acceso protegido."}
          </p>
          <div className="signinStatusRow">
            <span>{sessionLocked ? "Bloqueado" : authMode === "production" ? "Producción" : "Demo controlado"}</span>
            <span>{oidcConfig.mode === "configured" ? "Conexión lista" : "Conexión pendiente"}</span>
            <span>{oidcStatus.jwksAvailable ? `${oidcStatus.jwksKeyCount} claves` : "Verificación pendiente"}</span>
            <span>{sessionTtlMinutes} min</span>
          </div>
        </div>
        <div className="portalHeaderRail">
          <div className="topbarStats signinStatsGrid">
            <span><strong>{sessionTtlMinutes}</strong> min</span>
            <span><strong>{demoUsers.length}</strong> perfiles</span>
            <span><strong>{oidcStatus.jwksAvailable ? oidcStatus.jwksKeyCount : 0}</strong> llaves</span>
            <span><strong>{sessionLocked ? "Bloqueada" : "Activa"}</strong> sesión</span>
          </div>
          <div className="signinRailNote">
            <span>{accessLabel}</span>
            <p>
              {sessionLocked
                ? "La sesión quedó bloqueada. Usa tu cuenta para recuperar el acceso."
                : authMode === "production"
                  ? "Producción activa. El acceso principal es corporativo."
                  : "Demo controlado para validación interna y pruebas guiadas."}
            </p>
          </div>
        </div>
      </header>

      <div className="signinCard signinSplit">
        <section className="signinBody">
          <p className="eyebrow">Iniciar sesión</p>
          <h2>Acceso principal</h2>
          <p className="signinLead">
            {sessionLocked
              ? "Vuelve a entrar con tu usuario y clave para desbloquear la plataforma."
              : "Usa tu cuenta de trabajo para el entorno real. El modo de prueba queda para validación interna."}
          </p>

          <div className="signinActions">
            <button className="primary" disabled={isPending} onClick={signInWithOidc} type="button">
              {accessButtonLabel}
            </button>
          </div>

          <div className="landingMiniGrid">
            <div className="landingMiniCard">
              <span>Acceso</span>
              <strong>{authMode === "production" ? "Corporativo" : "Controlado"}</strong>
            </div>
            <div className="landingMiniCard">
              <span>Sesión</span>
              <strong>{sessionLocked ? "Bloqueada" : "Activa"}</strong>
            </div>
          </div>

          <div className="signinQuickGrid">
            <div className="signinQuickCard">
              <span>Ruta sugerida</span>
              <strong>{sessionLocked ? "Desbloqueo" : authMode === "production" ? "Corporativo" : "Demo"}</strong>
            </div>
            <div className="signinQuickCard">
              <span>Validez</span>
              <strong>{sessionTtlMinutes} minutos</strong>
            </div>
          </div>

          {!sessionLocked && authMode === "demo" ? (
            <div className="signinDemo">
              <span>Usuarios demo</span>
              <div className="roleSwitcher">
                {demoUsers.map((user) => (
                  <button disabled={isPending} key={user.id} onClick={() => signInWithDemoUser(user.id)} type="button">
                    {user.name}
                    <small>{user.role}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
