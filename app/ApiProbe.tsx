"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@/lib/nexera/contracts";

type ProbeResult = {
  endpoint: string;
  method: "GET" | "POST";
  role: UserRole;
  status: number;
  preview: string;
};

type ProbeEndpoint = {
  label: string;
  path: string;
  method: "GET" | "POST";
};

const roles: UserRole[] = ["Usuario", "Analista", "Ejecutivo", "Admin"];

const endpoints: ProbeEndpoint[] = [
  { label: "health", method: "GET", path: "/api/health" },
  { label: "session", method: "GET", path: "/api/auth/session" },
  { label: "logout", method: "POST", path: "/api/auth/logout" },
  { label: "oidc status", method: "GET", path: "/api/auth/oidc/status" },
  { label: "oidc jwks", method: "GET", path: "/api/auth/oidc/jwks/status" },
  { label: "oidc login", method: "GET", path: "/api/auth/oidc/login" },
  { label: "persistence", method: "GET", path: "/api/persistence/status" },
  { label: "pilot readiness", method: "GET", path: "/api/pilot/readiness" },
  { label: "demo cleanup", method: "POST", path: "/api/admin/demo-data/cleanup" },
  { label: "glpi status", method: "GET", path: "/api/integrations/glpi/status" },
  { label: "tickets", method: "GET", path: "/api/tickets" },
  { label: "users", method: "GET", path: "/api/users" },
  { label: "tenants", method: "GET", path: "/api/tenants" },
  { label: "audit", method: "GET", path: "/api/audit" },
  { label: "knowledge", method: "GET", path: "/api/knowledge" },
  { label: "agents", method: "GET", path: "/api/agents" },
  { label: "security", method: "GET", path: "/api/security/events" },
  { label: "security config", method: "GET", path: "/api/security/config" },
  { label: "rustdesk connectors", method: "GET", path: "/api/integrations/rustdesk" },
  { label: "rustdesk sessions", method: "GET", path: "/api/integrations/rustdesk/session" },
];

export function ApiProbe() {
  const [role, setRole] = useState<UserRole>("Analista");
  const [result, setResult] = useState<ProbeResult>({
    endpoint: "/api/health",
    method: "GET",
    role: "Analista",
    status: 200,
    preview: "Backend operativo listo para probar.",
  });
  const [isPending, startTransition] = useTransition();

  function probe(endpoint: ProbeEndpoint) {
    startTransition(async () => {
      const url = endpoint.path === "/api/auth/session" ? `${endpoint.path}?role=${role}` : endpoint.path;
      const response = await fetch(url, {
        headers: { "x-nexera-role": role },
        method: endpoint.method,
      });
      const payload = await response.json();

      setResult({
        endpoint: endpoint.path,
        method: endpoint.method,
        role,
        status: response.status,
        preview: JSON.stringify(payload, null, 2).slice(0, 420),
      });
    });
  }

  return (
    <div className="apiProbe">
      <div className="probeToolbar">
        <span>Rol de prueba</span>
        <select aria-label="Rol para probar APIs" onChange={(event) => setRole(event.target.value as UserRole)} value={role}>
          {roles.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="probeActions">
        {endpoints.map((endpoint) => (
          <button key={endpoint.path} onClick={() => probe(endpoint)} type="button">
            {endpoint.label}
          </button>
        ))}
      </div>
      <pre aria-live="polite">
        {isPending ? "Consultando API Nexpertic..." : `${result.method} ${result.endpoint} · ${result.role} · HTTP ${result.status}\n${result.preview}`}
      </pre>
    </div>
  );
}
