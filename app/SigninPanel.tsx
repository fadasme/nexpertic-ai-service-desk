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
      <div className="signinHero">
        <p className="eyebrow">Acceso seguro</p>
        <h1>Nexpertic AI Service Desk</h1>
        <p>{sessionLocked ? "Tu sesión quedó bloqueada. Vuelve a entrar con tu usuario y clave para recuperar el acceso." : "Ingresa con tu cuenta para continuar al panel operativo y mantener el acceso protegido."}</p>
        <div className="signinPills">
          <span className="badge">{sessionLocked ? "Bloqueado" : authMode === "production" ? "Produccion" : "Demo controlado"}</span>
          <span className="badge warning">RBAC</span>
          <span className="badge">Auditado</span>
          <span className="badge">Sesion {sessionTtlMinutes} min</span>
        </div>
        <div className="authModeBanner">
          <p className="eyebrow">Preparación de acceso</p>
          <h2>{sessionLocked ? "La sesión está bloqueada" : authMode === "production" ? "Acceso corporativo activo" : "Acceso de prueba habilitado"}</h2>
          <p>
            {sessionLocked
              ? "Solo una nueva validación con usuario y clave puede abrir de nuevo la plataforma."
              : authMode === "production"
              ? "La instancia está lista para iniciar sesión con tu cuenta de trabajo."
              : "Todavía puedes entrar con cuentas de prueba mientras terminamos la conexión segura."}
          </p>
          <div className="authModeBannerMeta">
            <span>{accessLabel}</span>
            <span>{oidcConfig.mode === "configured" ? "Conexión lista" : "Conexión pendiente"}</span>
            <span>{oidcStatus.jwksAvailable ? `${oidcStatus.jwksKeyCount} claves de seguridad` : "Verificación pendiente"}</span>
          </div>
        </div>
      </div>

      <div className="signinCard">
        <div>
          <p className="eyebrow">Iniciar sesión</p>
          <h2>Elige tu forma de entrar</h2>
          <p>{sessionLocked ? "Vuelve a entrar con tu usuario y clave para desbloquear la plataforma." : "Usa tu cuenta de trabajo para el entorno real. El modo de prueba queda para validación interna y pruebas guiadas."}</p>
          <p className="permissionHint">La sesión expira automáticamente después de {sessionTtlMinutes} minutos para reducir riesgo si el equipo queda desatendido.</p>
        </div>

        <div className="signinActions">
          <button className="primary" disabled={isPending} onClick={signInWithOidc} type="button">
            {accessButtonLabel}
          </button>
        </div>

        {!sessionLocked && authMode === "demo" ? (
          <div className="signinDemo">
            <span>Modo de prueba</span>
            <div className="roleSwitcher">
              {demoUsers.map((user) => (
                <button disabled={isPending} key={user.id} onClick={() => signInWithDemoUser(user.id)} type="button">
                  {user.name}
                  <small>{user.role}</small>
                </button>
              ))}
            </div>
            <p className="permissionHint">Cada perfil abre su propia experiencia para separar el trabajo inicial.</p>
          </div>
        ) : (
          <p className="permissionHint">La instancia está en modo producción. Usa tu cuenta de trabajo para entrar.</p>
        )}

        <div className="signinDemo">
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
        </div>
      </div>
    </section>
  );
}
