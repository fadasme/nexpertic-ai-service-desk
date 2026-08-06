"use client";

import { useTransition } from "react";
import type { SessionUser, UserAccount } from "@/lib/nexera/contracts";

type SigninPanelProps = {
  authMode: "demo" | "production";
  returnTo: string;
  users: UserAccount[];
};

export function SigninPanel({ authMode, returnTo, users }: SigninPanelProps) {
  const [isPending, startTransition] = useTransition();
  const demoUsers = users.filter((user) => ["Usuario", "Analista", "Ejecutivo", "Admin"].includes(user.role));
  const returnByRole: Record<string, string> = {
    Admin: "/admin",
    Analista: "/analista",
    Ejecutivo: "/ejecutivo",
    Usuario: "/usuario",
  };

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

  return (
    <section className="signinGrid" aria-label="Ingreso a Nexpertic">
      <div className="signinHero">
        <p className="eyebrow">Acceso seguro</p>
        <h1>Nexpertic AI Service Desk</h1>
        <p>Ingresa con una sesion firmada para continuar al panel operativo y mantener auditabilidad completa.</p>
        <div className="signinPills">
          <span className="badge">{authMode === "production" ? "Produccion" : "Demo controlado"}</span>
          <span className="badge warning">RBAC</span>
          <span className="badge">Auditado</span>
        </div>
      </div>

      <div className="signinCard">
        <div>
          <p className="eyebrow">Iniciar sesion</p>
          <h2>Elige tu metodo de acceso</h2>
          <p>OIDC para piloto real. Demo solo para validacion interna y pruebas guiadas.</p>
        </div>

        <div className="signinActions">
          <button className="primary" disabled={isPending} onClick={signInWithOidc} type="button">
            Continuar con OIDC
          </button>
          <a className="buttonLike" href={returnTo}>
            Volver al inicio
          </a>
        </div>

        {authMode === "demo" ? (
          <div className="signinDemo">
            <span>Acceso demo</span>
            <div className="roleSwitcher">
              {demoUsers.map((user) => (
                <button disabled={isPending} key={user.id} onClick={() => signInWithDemoUser(user.id)} type="button">
                  {user.name}
                  <small>{user.role}</small>
                </button>
              ))}
            </div>
            <p className="permissionHint">Usuario aterriza en /usuario, Analista en /analista, Ejecutivo en /ejecutivo y Admin en /admin para separar la experiencia inicial.</p>
          </div>
        ) : (
          <p className="permissionHint">La instancia esta en modo produccion. Usa OIDC para autenticacion real.</p>
        )}
      </div>
    </section>
  );
}
