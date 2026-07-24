"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { suggestKnowledgeArticle } from "@/lib/nexera/knowledge-search";
import type { AuditEvent, CreateAuditEventInput, CreateTicketInput, KnowledgeArticle, RemoteSupportSession, SessionUser, Ticket, TicketPriority, TicketStatus, UpdateTicketInput } from "@/lib/nexera/contracts";

type ChatMessage = {
  author: "agent" | "user";
  text: string;
};

type ConsoleNotice = {
  kind: "success" | "warning" | "error";
  text: string;
};

type ServiceDeskConsoleProps = {
  initialAuditEvents: AuditEvent[];
  initialKnowledgeArticles: KnowledgeArticle[];
  initialRemoteSessions: RemoteSupportSession[];
  initialSession: SessionUser;
  initialTickets: Ticket[];
};

function priorityClass(priority: TicketPriority) {
  if (priority === "Critica") return "badge danger";
  if (priority === "Alta") return "badge warning";
  return "badge";
}

function inferTicket(description: string, count: number): Ticket {
  const lower = description.toLowerCase();
  const isIdentity = lower.includes("365") || lower.includes("correo") || lower.includes("clave");
  const isVpn = lower.includes("vpn");
  const isEndpoint = lower.includes("notebook") || lower.includes("lento");
  const priority: TicketPriority = lower.includes("urgente") || lower.includes("caido") ? "Alta" : "Media";

  return {
    id: `NX-${1043 + count}`,
    externalRef: "Pendiente GLPI",
    title: description.length > 62 ? `${description.slice(0, 62)}...` : description,
    requester: "Usuario demo",
    priority,
    status: "Nuevo",
    owner: "Mesa L1",
    category: isIdentity ? "Identidad" : isVpn ? "Conectividad" : isEndpoint ? "Endpoint" : "General",
    confidence: isIdentity || isVpn || isEndpoint ? 86 : 69,
    aiSummary: isIdentity
      ? "Revisar licencia, MFA y bloqueo condicional. Fuente sugerida: Microsoft 365."
      : isVpn
        ? "Validar perfil VPN, MFA y credenciales recientes. Fuente sugerida: VPN corporativa."
        : isEndpoint
          ? "Solicitar telemetria y revisar aplicaciones de inicio. Fuente sugerida: Notebook lento."
          : "Solicitud normalizada por agente recepcionista. Requiere enriquecimiento RAG.",
    sla: priority === "Alta" ? "En riesgo" : "Normal",
    source: "chat",
    createdAt: new Date().toISOString(),
  };
}

function hasPermission(session: SessionUser, permission: string) {
  return session.permissions.includes("*") || session.permissions.includes(permission);
}

function mergeRemoteSession(sessions: RemoteSupportSession[], session: RemoteSupportSession) {
  return [session, ...sessions.filter((item) => item.id !== session.id)];
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
}

export function ServiceDeskConsole({ initialAuditEvents, initialKnowledgeArticles, initialRemoteSessions, initialSession, initialTickets }: ServiceDeskConsoleProps) {
  const [session, setSession] = useState(initialSession);
  const [tickets, setTickets] = useState(initialTickets);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(initialAuditEvents);
  const [selectedId, setSelectedId] = useState(initialTickets[0]?.id);
  const [priority, setPriority] = useState<TicketPriority | "Todas">("Todas");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<ConsoleNotice | null>(null);
  const [remoteSessions, setRemoteSessions] = useState<RemoteSupportSession[]>(initialRemoteSessions);
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      author: "agent",
      text: "Hola, soy el agente conversacional de Nexpertic. Describe el problema y preparare el ticket con contexto tecnico.",
    },
  ]);

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesPriority = priority === "Todas" || ticket.priority === priority;
      const matchesQuery =
        !normalized ||
        [ticket.id, ticket.title, ticket.requester, ticket.status, ticket.owner, ticket.category]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesPriority && matchesQuery;
    });
  }, [priority, query, tickets]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null;
  const selectedAudit = selectedTicket ? auditEvents.filter((event) => event.ticketId === selectedTicket.id) : [];
  const remoteSession = selectedTicket ? remoteSessions.find((item) => item.ticketId === selectedTicket.id) ?? null : null;
  const canCreateTicket = hasPermission(session, "ticket:create");
  const canUpdateTicket = hasPermission(session, "ticket:update");
  const canSyncGlpi = hasPermission(session, "ticket:sync-glpi");
  const canPullGlpi = canSyncGlpi && Boolean(selectedTicket?.externalRef.match(/^GLPI-\d+$/));
  const canUseRustDesk = hasPermission(session, "rustdesk:session");
  const canReadAudit = hasPermission(session, "audit:read");
  const isSelfServiceUser = hasPermission(session, "ticket:read:self") && !hasPermission(session, "ticket:read");
  const ticketPanelCopy = isSelfServiceUser
    ? {
        empty: "Aun no tienes tickets asociados. Crea el primer caso desde el chat de soporte.",
        eyebrow: "Portal usuarios",
        heading: "Mis tickets",
        scope: "Solo tus solicitudes",
      }
    : {
        empty: "Sin tickets aun. Crea el primer caso desde el portal de usuarios.",
        eyebrow: "Operacion",
        heading: "Cola inteligente",
        scope: "Cola del tenant",
      };
  const detailCopy = isSelfServiceUser
    ? {
        eyebrow: "Seguimiento",
        heading: "Estado de solicitud",
      }
    : {
        eyebrow: "Copiloto L2",
        heading: "Detalle asistido",
      };

  useEffect(() => {
    function onRoleChange(event: Event) {
      setSession((event as CustomEvent<SessionUser>).detail);
    }

    window.addEventListener("nexera:role-change", onRoleChange);
    return () => window.removeEventListener("nexera:role-change", onRoleChange);
  }, []);

  useEffect(() => {
    if (!selectedTicket || !canReadAudit) return;

    let isActive = true;

    async function loadAuditEvents() {
      const response = await fetch(`/api/audit?ticketId=${selectedTicket.id}`, {
        headers: { "x-nexera-role": session.role },
      });

      if (!response.ok) return;

      const result = (await response.json()) as { data: AuditEvent[] };
      if (isActive) {
        setAuditEvents((current) => [
          ...result.data,
          ...current.filter((event) => event.ticketId !== selectedTicket.id),
        ]);
      }
    }

    void loadAuditEvents().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [canReadAudit, selectedTicket, session.role]);

  useEffect(() => {
    if (!selectedTicket || !canUseRustDesk) return;

    let isActive = true;

    async function loadRemoteSessions() {
      const response = await fetch(`/api/integrations/rustdesk/session?ticketId=${selectedTicket.id}`, {
        headers: { "x-nexera-role": session.role },
      });

      if (!response.ok) return;

      const result = (await response.json()) as { data: RemoteSupportSession[] };
      if (isActive) {
        setRemoteSessions((current) => [
          ...result.data,
          ...current.filter((item) => item.ticketId !== selectedTicket.id),
        ]);
      }
    }

    void loadRemoteSessions().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [canUseRustDesk, selectedTicket, session.role]);

  async function appendAudit(ticketId: string, actor: AuditEvent["actor"], action: string, detail: string) {
    const fallbackEvent: AuditEvent = {
      id: `audit-${ticketId}-${Date.now()}`,
      ticketId,
      actor,
      action,
      detail,
      at: new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    };

    try {
      const payload: CreateAuditEventInput = { action, actor, detail, ticketId };
      const response = await fetch("/api/audit", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (response.ok) {
        const result = (await response.json()) as { data: AuditEvent };
        setAuditEvents((current) => [result.data, ...current]);
        return;
      }
    } catch {
      // Keep local traceability if the API server is unavailable.
    }

    setAuditEvents((current) => [fallbackEvent, ...current]);
  }

  async function createTicket(description: string) {
    const payload: CreateTicketInput = {
      description,
      requester: "Usuario demo",
      source: "chat",
    };
    let ticket = inferTicket(description, tickets.length);
    let storedRemotely = false;

    try {
      const response = await fetch("/api/tickets", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo crear el ticket.") });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      ticket = result.data;
      storedRemotely = true;
    } catch {
      setNotice({ kind: "warning", text: "API no disponible. Se creo un ticket local temporal para no detener la operacion." });
    }

    setTickets((current) => [ticket, ...current]);
    setSelectedId(ticket.id);
    const knowledgeSuggestion = suggestKnowledgeArticle(initialKnowledgeArticles, description);
    setMessages((current) => [
      ...current,
      { author: "user", text: description },
      {
        author: "agent",
        text: knowledgeSuggestion
          ? `Ticket ${ticket.id} creado, clasificado como ${ticket.priority}. Sugerencia RAG: ${knowledgeSuggestion.id} · ${knowledgeSuggestion.title} (${knowledgeSuggestion.qualityScore}% calidad).`
          : `Ticket ${ticket.id} creado, clasificado como ${ticket.priority} y preparado para sincronizar con GLPI Core.`,
      },
    ]);
    if (!storedRemotely) {
      void appendAudit(ticket.id, "Usuario", "Ticket creado via chat", description);
      void appendAudit(ticket.id, "Agente IA", "Clasificacion y enriquecimiento", `${ticket.category}, prioridad ${ticket.priority}, confianza ${ticket.confidence}%.`);
      if (knowledgeSuggestion) {
        void appendAudit(ticket.id, "Agente IA", "Knowledge sugerido", `${knowledgeSuggestion.id} · ${knowledgeSuggestion.title}.`);
      }
    }
    if (storedRemotely) {
      setNotice({ kind: "success", text: `Ticket ${ticket.id} creado y guardado.` });
    }
  }

  function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = draft.trim();
    if (!description || !canCreateTicket) return;

    setDraft("");
    startTransition(() => {
      void createTicket(description);
    });
  }

  async function updateSelected(status: TicketStatus, owner: string) {
    if (!selectedTicket) return;

    const payload: UpdateTicketInput = { owner, status };
    const previousTicket = selectedTicket;
    let storedRemotely = false;

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo actualizar el ticket.") });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      setTickets((current) =>
        current.map((ticket) => (ticket.id === selectedTicket.id ? result.data : ticket)),
      );
      storedRemotely = true;
    } catch {
      setTickets((current) =>
        current.map((ticket) => (ticket.id === previousTicket.id ? { ...previousTicket, status, owner } : ticket)),
      );
      setNotice({ kind: "warning", text: "API no disponible. Cambio aplicado localmente como contingencia." });
    }

    void appendAudit(selectedTicket.id, "Analista", `Estado actualizado a ${status}`, `Responsable: ${owner}.`);
    if (storedRemotely) {
      setNotice({ kind: "success", text: `${selectedTicket.id} actualizado a ${status}.` });
    }
  }

  async function syncSelectedWithGlpi() {
    if (!selectedTicket) return;

    let externalRef = selectedTicket.externalRef;

    try {
      const response = await fetch("/api/integrations/glpi/sync", {
        body: JSON.stringify({ ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo sincronizar con GLPI.") });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      externalRef = result.data.externalRef;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API GLPI. La referencia no fue cambiada." });
      return;
    }

    setTickets((current) =>
      current.map((ticket) => (ticket.id === selectedTicket.id ? { ...ticket, externalRef } : ticket)),
    );

    void appendAudit(selectedTicket.id, "GLPI Adapter", "Sincronizacion solicitada", `Referencia operacional ${externalRef}.`);
    setNotice({ kind: "success", text: `${selectedTicket.id} sincronizado con referencia ${externalRef}.` });
  }

  async function pullSelectedFromGlpi() {
    if (!selectedTicket) return;

    try {
      const response = await fetch("/api/integrations/glpi/sync", {
        body: JSON.stringify({ direction: "pull", ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo actualizar desde GLPI.") });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      setTickets((current) =>
        current.map((ticket) => (ticket.id === selectedTicket.id ? result.data : ticket)),
      );
      void appendAudit(selectedTicket.id, "GLPI Adapter", "Actualizacion recibida desde GLPI", `Estado ${result.data.status}, prioridad ${result.data.priority}.`);
      setNotice({ kind: "success", text: `${selectedTicket.id} actualizado desde GLPI.` });
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API GLPI para traer cambios." });
    }
  }

  async function startRemoteSession() {
    if (!selectedTicket) return;

    let supportSession: RemoteSupportSession = {
      id: `rs-${selectedTicket.id}-${Date.now()}`,
      ticketId: selectedTicket.id,
      provider: "RustDesk",
      code: `RD-${Math.floor(100000 + Math.random() * 899999)}`,
      status: "Esperando consentimiento",
      expiresInMinutes: 15,
      launchUrl: `rustdesk://connect/${selectedTicket.id.toLowerCase()}`,
      createdAt: new Date().toISOString(),
      consentExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      consentToken: crypto.randomUUID(),
    };
    let storedRemotely = false;

    try {
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo preparar RustDesk.") });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      supportSession = result.data;
      storedRemotely = true;
    } catch {
      setNotice({ kind: "warning", text: "API no disponible. Sesion RustDesk creada localmente como contingencia." });
    }

    setRemoteSessions((current) => mergeRemoteSession(current, supportSession));
    void appendAudit(
      selectedTicket.id,
      "RustDesk",
      "Sesion remota preparada",
      `Invitacion ${supportSession.code} preparada para ${selectedTicket.requester}. Requiere consentimiento del usuario antes de conectar.`,
    );
    if (storedRemotely) {
      setNotice({ kind: "success", text: `Sesion RustDesk ${supportSession.code} preparada.` });
    }
  }

  async function sendRemoteInvite() {
    if (!remoteSession) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Invitacion enviada" };

    try {
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Invitacion enviada" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo enviar la invitacion RustDesk.") });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API RustDesk. La invitacion no fue marcada como enviada." });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    setMessages((current) => [
      ...current,
      {
        author: "agent",
        text: `Invitacion RustDesk ${updatedSession.code} enviada al usuario. Expira en ${updatedSession.expiresInMinutes} minutos.`,
      },
    ]);
    void appendAudit(updatedSession.ticketId, "RustDesk", "Invitacion enviada", `Codigo ${updatedSession.code}. Esperando consentimiento.`);
    setNotice({ kind: "success", text: `Invitacion ${updatedSession.code} enviada.` });
  }

  async function grantRemoteConsent() {
    if (!remoteSession) return;

    const consentGrantedAt = new Date().toISOString();
    let updatedSession: RemoteSupportSession = { ...remoteSession, consentGrantedAt };

    try {
      const response = await fetch("/api/integrations/rustdesk/consent", {
        body: JSON.stringify({ decision: "approve", token: remoteSession.consentToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo registrar el consentimiento.") });
        return;
      }

      updatedSession = { ...updatedSession, consentGrantedAt };
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API de consentimiento. La aprobacion no fue registrada." });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "Usuario", "Consentimiento RustDesk aprobado", `Sesion ${updatedSession.code}.`);
    setNotice({ kind: "success", text: `Consentimiento registrado para ${updatedSession.code}.` });
  }

  async function connectRemoteSession() {
    if (!remoteSession || !remoteSession.consentGrantedAt) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Conectado" };

    try {
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Conectado" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo conectar RustDesk.") });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API RustDesk. La sesion no fue conectada." });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "RustDesk", "Sesion remota conectada", `Conexion autorizada con codigo ${updatedSession.code}.`);
    setNotice({ kind: "success", text: `Sesion ${updatedSession.code} conectada.` });
  }

  return (
    <>
      <article className="panel span2" id="command-center">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">{ticketPanelCopy.eyebrow}</p>
            <h2>{ticketPanelCopy.heading}</h2>
          </div>
          <div className="filterBar">
            <span className="scopePill">{ticketPanelCopy.scope}</span>
            <input aria-label="Buscar ticket" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ticket..." value={query} />
            <select aria-label="Filtrar prioridad" onChange={(event) => setPriority(event.target.value as TicketPriority | "Todas")} value={priority}>
              <option>Todas</option>
              <option>Critica</option>
              <option>Alta</option>
              <option>Media</option>
            </select>
          </div>
        </div>

        <div className="ticketList">
          {filteredTickets.map((ticket) => (
            <button className={`ticketCard ${ticket.id === selectedTicket?.id ? "selected" : ""}`} key={ticket.id} onClick={() => setSelectedId(ticket.id)} type="button">
              <div className="ticketTopline">
                <strong>{ticket.id}</strong>
                <span className={priorityClass(ticket.priority)}>{ticket.priority}</span>
              </div>
              <h3>{ticket.title}</h3>
              <p>{ticket.aiSummary}</p>
              <div className="ticketMeta">
                {!isSelfServiceUser ? <span>{ticket.requester}</span> : null}
                <span>{ticket.status}</span>
                <span>{ticket.owner}</span>
                <span>{ticket.category}</span>
                <span>IA {ticket.confidence}%</span>
              </div>
            </button>
          ))}
          {!filteredTickets.length ? <p className="emptyState">{ticketPanelCopy.empty}</p> : null}
        </div>
      </article>

      <article className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">{detailCopy.eyebrow}</p>
            <h2>{detailCopy.heading}</h2>
          </div>
        </div>
        {selectedTicket ? (
          <>
            <div className="copilotPanel">
              <strong>{selectedTicket.id}: {selectedTicket.title}</strong>
              <p>{selectedTicket.aiSummary}</p>
              {notice ? <p className={`consoleNotice ${notice.kind}`} role="status">{notice.text}</p> : null}
              <div className="ticketMeta">
                <span className={priorityClass(selectedTicket.priority)}>{selectedTicket.priority}</span>
                <span className="badge">{selectedTicket.status}</span>
                <span className="badge">Confianza {selectedTicket.confidence}%</span>
                <span className="badge">{selectedTicket.externalRef}</span>
              </div>
              {canUpdateTicket || canSyncGlpi || canUseRustDesk ? (
                <div className="actionStack">
                  <button className="primary" disabled={!canUpdateTicket} onClick={() => void updateSelected("Asignado", "Mesa L1")} type="button">Asignar L1</button>
                  <button disabled={!canUpdateTicket} onClick={() => void updateSelected("Escalado", "Especialista L2")} type="button">Escalar L2</button>
                  <button disabled={!canUpdateTicket} onClick={() => void updateSelected("Resuelto", "Mesa L1")} type="button">Resolver</button>
                  <button disabled={!canSyncGlpi} onClick={() => void syncSelectedWithGlpi()} type="button">Sincronizar GLPI</button>
                  <button disabled={!canPullGlpi} onClick={() => void pullSelectedFromGlpi()} type="button">Actualizar desde GLPI</button>
                  <button disabled={!canUseRustDesk} onClick={startRemoteSession} type="button">Sesion RustDesk</button>
                </div>
              ) : (
                <p className="permissionHint">Tu solicitud ya esta registrada. El equipo de soporte actualizara el estado y dejara trazabilidad visible cuando corresponda.</p>
              )}
            </div>
            {remoteSession?.ticketId === selectedTicket.id ? (
              <div className="remoteSessionCard">
                <div className="ticketTopline">
                  <strong>{remoteSession.code}</strong>
                  <span className="badge warning">{remoteSession.status}</span>
                </div>
                <p>Sesion vinculada a {selectedTicket.id}. Requiere consentimiento explicito del usuario antes de iniciar control remoto.</p>
                <div className="ticketMeta">
                  <span>{remoteSession.provider}</span>
                  <span>Expira en {remoteSession.expiresInMinutes} min</span>
                  <span>{remoteSession.consentGrantedAt ? "Consentimiento registrado" : "Consentimiento pendiente"}</span>
                  <span>{remoteSession.launchUrl}</span>
                </div>
                {remoteSession.consentToken.includes(".") ? (
                  <a className="consentLink" href={`/consentimiento-rustdesk?token=${remoteSession.consentToken}`} target="_blank" rel="noreferrer">
                    Abrir portal de consentimiento
                  </a>
                ) : (
                  <span className="permissionHint">Portal de consentimiento disponible cuando la API firma el token.</span>
                )}
                <div className="actionStack">
                  <button className="primary" disabled={remoteSession.status !== "Esperando consentimiento"} onClick={() => void sendRemoteInvite()} type="button">Enviar invitacion</button>
                  <button disabled={Boolean(remoteSession.consentGrantedAt)} onClick={() => void grantRemoteConsent()} type="button">Registrar consentimiento</button>
                  <button disabled={!remoteSession.consentGrantedAt || remoteSession.status === "Conectado"} onClick={() => void connectRemoteSession()} type="button">Conectar</button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="emptyState">Selecciona o crea un ticket para activar el copiloto L2.</p>
        )}
      </article>

      <article className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Auditoria</p>
            <h2>Trazabilidad</h2>
          </div>
        </div>
        <div className="timeline">
          {!canReadAudit ? (
            <p className="emptyState">La auditoria interna esta reservada para analistas y administradores.</p>
          ) : selectedAudit.length ? (
            selectedAudit.map((event) => (
              <div key={event.id}>
                <strong>{event.actor} · {event.action}</strong>
                <p>{event.detail}</p>
                <span>{event.at}</span>
              </div>
            ))
          ) : (
            <p className="emptyState">Sin eventos de auditoria para este ticket.</p>
          )}
        </div>
      </article>

      <article className="panel" id="usuarios">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Portal usuarios</p>
            <h2>Chat de soporte</h2>
          </div>
        </div>
        <div className="chatBox">
          {messages.map((message, index) => (
            <p className={message.author === "user" ? "userBubble" : ""} key={`${message.author}-${index}`}>{message.text}</p>
          ))}
        </div>
        <form className="chatComposer" onSubmit={submitTicket}>
          <input disabled={!canCreateTicket} onChange={(event) => setDraft(event.target.value)} placeholder={canCreateTicket ? "Describe el incidente..." : "El rol actual no puede crear tickets"} value={draft} />
          <button className="primary" disabled={isPending || !canCreateTicket} type="submit">{isPending ? "Creando..." : "Crear ticket"}</button>
        </form>
        {!canCreateTicket ? <p className="permissionHint">Accion bloqueada para {session.role}: cambia a Usuario o Admin para simular creacion de tickets.</p> : null}
      </article>
    </>
  );
}
