"use client";

import { useState, useTransition } from "react";
import type { UserAccount, UserRole } from "@/lib/nexera/contracts";

type UserAdminPanelProps = {
  initialUsers: UserAccount[];
};

type PanelNotice = {
  kind: "success" | "error";
  text: string;
};

const roles: UserRole[] = ["Usuario", "Analista", "Ejecutivo", "Admin"];

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
}

function compactAccess(value?: string) {
  return value ? `${value.slice(0, 10)} ${value.slice(11, 16)} UTC` : "Sin acceso";
}

export function UserAdminPanel({ initialUsers }: UserAdminPanelProps) {
  const [users, setUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<PanelNotice | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeRole(userId: string, role: UserRole) {
    startTransition(async () => {
      const response = await fetch(`/api/users/${userId}/role`, {
        body: JSON.stringify({ role }),
        headers: { "content-type": "application/json", "x-nexera-role": "Admin" },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo actualizar el rol.") });
        return;
      }

      const result = (await response.json()) as { data: UserAccount };
      setUsers((current) => current.map((user) => (user.id === userId ? result.data : user)));
      setNotice({ kind: "success", text: `${result.data.name} ahora tiene rol ${result.data.role}.` });
    });
  }

  return (
    <div className="userAdminPanel">
      {notice ? <p className={`consoleNotice ${notice.kind}`} role="status">{notice.text}</p> : null}
      <div className="userTable">
        <div className="userTableHeader">
          <strong>Usuario</strong>
          <strong>Rol</strong>
          <strong>Estado</strong>
          <strong>Permisos efectivos</strong>
        </div>
        {users.map((user) => (
          <div className="userRow" key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>{user.tenant} · {compactAccess(user.lastAccessAt)}</small>
            </div>
            <select aria-label={`Rol de ${user.name}`} disabled={isPending} onChange={(event) => changeRole(user.id, event.target.value as UserRole)} value={user.role}>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <span className="badge">{user.status}</span>
            <div className="permissionList">
              {user.permissions.map((permission) => (
                <span key={permission}>{permission}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="permissionHint">Base lista para SSO/OIDC: el proveedor externo podra poblar identidad y este modulo resolvera rol/permisos por tenant.</p>
    </div>
  );
}
