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

type ProbeHistoryItem = ProbeResult & {
  at: string;
  tone: "ok" | "warning" | "danger";
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
  { label: "cleanup datos", method: "POST", path: "/api/admin/demo-data/cleanup" },
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
  const [history, setHistory] = useState<ProbeHistoryItem[]>([]);
  const [isPending, startTransition] = useTransition();

  const healthyCalls = history.filter((item) => item.status >= 200 && item.status < 400).length;
  const failingCalls = history.filter((item) => item.status >= 400).length;
  const latest = history[0] ?? null;

  function probe(endpoint: ProbeEndpoint) {
    startTransition(async () => {
      const url = endpoint.path === "/api/auth/session" ? `${endpoint.path}?role=${role}` : endpoint.path;
      const response = await fetch(url, {
        headers: { "x-nexera-role": role },
        method: endpoint.method,
      });
      const payload = await response.json();
      const status = response.status;
      const tone: ProbeHistoryItem["tone"] = status >= 200 && status < 400 ? "ok" : status >= 500 ? "danger" : "warning";
      const nextResult: ProbeResult = {
        endpoint: endpoint.path,
        method: endpoint.method,
        role,
        status,
        preview: JSON.stringify(payload, null, 2).slice(0, 420),
      };

      setResult(nextResult);
      setHistory((current) => [
        { ...nextResult, at: new Date().toISOString(), tone },
        ...current.filter((item) => item.endpoint !== endpoint.path || item.method !== endpoint.method).slice(0, 3),
      ]);
    });
  }

  return (
    <div className="apiProbe">
      <div className="probeToolbar">
        <div className="probeIdentity">
          <span>Rol activo</span>
          <strong>{role}</strong>
        </div>
        <select aria-label="Rol para probar APIs" onChange={(event) => setRole(event.target.value as UserRole)} value={role}>
          {roles.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="probeExecutive">
        <div>
          <span>Exitosas</span>
          <strong>{healthyCalls}</strong>
        </div>
        <div>
          <span>Alertas</span>
          <strong>{failingCalls}</strong>
        </div>
        <div>
          <span>Ultimo status</span>
          <strong>HTTP {result.status}</strong>
        </div>
        <p>{latest ? `${latest.method} ${latest.endpoint} · ${latest.role}` : "Sin historial de consultas."}</p>
      </div>
      <div className="probeActions">
        {endpoints.map((endpoint) => (
          <button key={endpoint.path} onClick={() => probe(endpoint)} type="button">
            {endpoint.label}
          </button>
        ))}
      </div>
      <div className="probeResultCard" aria-live="polite">
        <div className={`probeStatus ${result.status >= 200 && result.status < 400 ? "ok" : result.status >= 500 ? "danger" : "warning"}`}>
          <span>{isPending ? "Consultando API Nexpertic..." : `${result.method} ${result.endpoint}`}</span>
          <strong>HTTP {result.status}</strong>
          <small>{result.role}</small>
        </div>
        <pre>{result.preview}</pre>
      </div>
      {history.length ? (
        <div className="probeHistory">
          {history.map((item) => (
            <div className={`probeHistoryItem ${item.tone}`} key={`${item.endpoint}-${item.at}`}>
              <div>
                <strong>{item.method} {item.endpoint}</strong>
                <span>{item.role} · {item.at.slice(11, 16)} UTC</span>
              </div>
              <small>HTTP {item.status}</small>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
