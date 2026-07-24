"use client";

import { useState, useTransition } from "react";
import type { SessionUser, UserAccount } from "@/lib/nexera/contracts";

type AccessControlPanelProps = {
  initialSession: SessionUser;
  users: UserAccount[];
};

export function AccessControlPanel({ initialSession, users }: AccessControlPanelProps) {
  const [session, setSession] = useState(initialSession);
  const [isPending, startTransition] = useTransition();

  function switchUser(userId: string) {
    startTransition(async () => {
      const response = await fetch("/api/auth/session", {
        body: JSON.stringify({ userId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { data: SessionUser };
      if (result.data) {
        setSession(result.data);
        window.dispatchEvent(new CustomEvent("nexera:role-change", { detail: result.data }));
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.dispatchEvent(new CustomEvent("nexera:role-change", { detail: initialSession }));
      setSession(initialSession);
    });
  }

  return (
    <section className="accessPanel" aria-label="Control de acceso">
      <div>
        <p className="eyebrow">Sesion operativa</p>
        <h2>{session.name}</h2>
        <p>{session.role} · {session.email} · {session.tenant}</p>
      </div>
      <div className="roleSwitcher">
        {users.map((user) => (
          <button className={session.id === user.id ? "primary" : ""} disabled={isPending} key={user.id} onClick={() => switchUser(user.id)} type="button">
            {user.name}
            <small>{user.role}</small>
          </button>
        ))}
        <button disabled={isPending} onClick={logout} type="button">
          Cerrar sesion
          <small>limpia cookie</small>
        </button>
      </div>
    </section>
  );
}
