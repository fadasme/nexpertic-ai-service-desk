"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { suggestKnowledgeArticle } from "@/lib/nexera/knowledge-search";
import { formatUtcTime } from "@/lib/nexera/time-format";
import { getTicketWorkflowSteps, suggestNextTicketStep } from "@/lib/nexera/ticket-workflow";
import type { AuditEvent, CreateAuditEventInput, CreateTicketInput, KnowledgeArticle, RemoteSupportSession, SessionUser, Ticket, TicketPriority, TicketStatus, UpdateTicketInput } from "@/lib/nexera/contracts";

type ChatMessage = {
  author: "agent" | "user";
  text: string;
};

type ConsoleNotice = {
  kind: "success" | "warning" | "error";
  text: string;
};

type TicketActionState =
  | { kind: "idle" }
  | { kind: "creating"; label: string }
  | { kind: "updating"; label: string }
  | { kind: "syncing"; label: string }
  | { kind: "remote"; label: string };

type QuickTemplate = {
  label: string;
  text: string;
};

type TicketDraftSignal = {
  category: string;
  priority: TicketPriority;
  confidence: number;
  summary: string;
  action: string;
};

type TicketClassification = TicketDraftSignal & {
  isIdentity: boolean;
  isVpn: boolean;
  isEndpoint: boolean;
  isSecurity: boolean;
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

function classifyTicketDescription(description: string): TicketClassification | null {
  const trimmed = description.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const isIdentity = lower.includes("365") || lower.includes("correo") || lower.includes("clave") || lower.includes("mfa");
  const isVpn = lower.includes("vpn") || lower.includes("acceso remoto");
  const isEndpoint = lower.includes("notebook") || lower.includes("lento") || lower.includes("equipo") || lower.includes("pc");
  const isSecurity = lower.includes("phishing") || lower.includes("alerta") || lower.includes("bloqueo") || lower.includes("riesgo");
  const priority: TicketPriority =
    lower.includes("urgente") || lower.includes("caido") || lower.includes("bloqueo") || lower.includes("critico")
      ? "Alta"
      : isSecurity
        ? "Alta"
        : "Media";
  const category = isIdentity ? "Identidad" : isVpn ? "Conectividad" : isEndpoint ? "Endpoint" : isSecurity ? "Seguridad" : "General";
  const confidence = isIdentity || isVpn || isEndpoint || isSecurity ? 87 : 69;
  const summary = isIdentity
    ? "Se sugiere validar licencias, MFA y bloqueo condicional."
    : isVpn
      ? "Se sugiere revisar perfil VPN, MFA y credenciales recientes."
      : isEndpoint
        ? "Se sugiere revisar telemetria y aplicaciones de inicio."
        : isSecurity
          ? "Se sugiere bloquear, revisar evidencia y elevar a seguridad."
          : "Se sugiere clasificacion manual con apoyo RAG.";
  const action = isIdentity
    ? "Validar acceso y MFA"
    : isVpn
      ? "Revisar perfil VPN"
      : isEndpoint
        ? "Solicitar telemetria"
        : isSecurity
          ? "Escalar a seguridad"
          : "Clasificar manualmente";

  return { action, category, confidence, isEndpoint, isIdentity, isSecurity, isVpn, priority, summary };
}

function inferTicket(description: string, count: number, overridePriority?: TicketPriority) {
  const classification = classifyTicketDescription(description);
  const isIdentity = Boolean(classification?.isIdentity);
  const isVpn = Boolean(classification?.isVpn);
  const isEndpoint = Boolean(classification?.isEndpoint);
  const isSecurity = Boolean(classification?.isSecurity);
  const priority = overridePriority ?? classification?.priority ?? "Media";

  return {
    id: `NX-${1043 + count}`,
    externalRef: "Pendiente GLPI",
    title: description.length > 62 ? `${description.slice(0, 62)}...` : description,
    requester: "Usuario interno",
    priority,
    status: "Nuevo",
    owner: "Mesa L1",
    category: isIdentity ? "Identidad" : isVpn ? "Conectividad" : isEndpoint ? "Endpoint" : isSecurity ? "Seguridad" : "General",
    confidence: isIdentity || isVpn || isEndpoint || isSecurity ? 87 : 69,
    aiSummary: isIdentity
      ? "Revisar licencia, MFA y bloqueo condicional. Fuente sugerida: Microsoft 365."
      : isVpn
        ? "Validar perfil VPN, MFA y credenciales recientes. Fuente sugerida: VPN corporativa."
        : isEndpoint
          ? "Solicitar telemetria y revisar aplicaciones de inicio. Fuente sugerida: Notebook lento."
          : isSecurity
            ? "Revisar indicador de compromiso, bloqueo y evidencia de seguridad. Fuente sugerida: Seguridad operativa."
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

function agentMessage(text: string): ChatMessage {
  return { author: "agent", text };
}

function getTicketProgressStep(kind: TicketActionState["kind"]) {
  if (kind === "creating") return "1/3 Clasificando";
  if (kind === "updating") return "2/3 Actualizando";
  if (kind === "syncing") return "2/3 Sincronizando";
  if (kind === "remote") return "3/3 Remoto";
  return "Listo para operar";
}

function previewTicketSignal(description: string): TicketDraftSignal | null {
  const classification = classifyTicketDescription(description);
  if (!classification) return null;

  const { action, category, confidence, priority, summary } = classification;
  return { action, category, confidence, priority, summary };
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
  const [draftPriority, setDraftPriority] = useState<TicketPriority | "Sugerida">("Sugerida");
  const [notice, setNotice] = useState<ConsoleNotice | null>(null);
  const [remoteSessions, setRemoteSessions] = useState<RemoteSupportSession[]>(initialRemoteSessions);
  const [ticketAction, setTicketAction] = useState<TicketActionState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const quickTemplates: QuickTemplate[] = [
    { label: "Correo M365", text: "No puedo iniciar sesion en Microsoft 365. Pide MFA y acceso urgente." },
    { label: "VPN lenta", text: "La VPN se desconecta y la notebook queda lenta al abrir aplicaciones de trabajo." },
    { label: "Notebook", text: "La notebook esta muy lenta desde hoy y tarda varios minutos en abrir." },
  ];
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      author: "agent",
      text: "Hola, soy el copiloto de Nexpertic. Describe el problema y preparare el ticket con contexto tecnico.",
    },
  ]);
  const ticketSignal = useMemo(() => previewTicketSignal(draft), [draft]);
  const ticketSignalTone = ticketSignal ? (ticketSignal.priority === "Alta" ? "danger" : "warning") : "warning";
  const ticketDraftPriority = draftPriority === "Sugerida" ? ticketSignal?.priority ?? "Media" : draftPriority;
  const ticketPriorityMode = draftPriority === "Sugerida" ? "Automatica" : "Manual";

  useEffect(() => {
    if (draftPriority === "Sugerida") {
      setDraftPriority(ticketSignal?.priority ?? "Media");
    }
  }, [draftPriority, ticketSignal?.priority]);

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
  const selectedAuditCount = selectedAudit.length;
  const remoteSession = selectedTicket ? remoteSessions.find((item) => item.ticketId === selectedTicket.id) ?? null : null;
  const selectedRemoteState = remoteSession ? remoteSession.status : "Sin sesion";
  const ticketWorkflowSteps = selectedTicket ? getTicketWorkflowSteps(selectedTicket) : [];
  const ticketNextStep = selectedTicket ? suggestNextTicketStep(selectedTicket) : null;
  const ticketTimeline = selectedTicket
    ? [
        {
          label: "Recepcion",
          detail: selectedTicket.source === "chat" ? "Solicitud recibida por el portal de usuarios." : `Ticket creado desde ${selectedTicket.source}.`,
          tone: "ok",
        },
        {
          label: "Clasificacion IA",
          detail: `Categoria ${selectedTicket.category} · confianza ${selectedTicket.confidence}%.`,
          tone: selectedTicket.confidence >= 80 ? "ok" : "warning",
        },
        {
          label: "Estado actual",
          detail: `${selectedTicket.status} · ${selectedTicket.owner}.`,
          tone: selectedTicket.status === "Resuelto" ? "ok" : "warning",
        },
        {
          label: "Integracion",
          detail: selectedTicket.externalRef === "Pendiente GLPI" ? "Pendiente de GLPI" : `GLPI ${selectedTicket.externalRef}.`,
          tone: selectedTicket.externalRef === "Pendiente GLPI" ? "warning" : "ok",
        },
      ]
    : [];
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
  const actionBusy = ticketAction.kind !== "idle";
  const actionLabel = ticketAction.kind === "idle" ? null : ticketAction.label;
  const ticketProgressStep = getTicketProgressStep(ticketAction.kind);

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
    const effectivePriority = draftPriority === "Sugerida" ? ticketSignal?.priority ?? "Media" : draftPriority;
    const payload: CreateTicketInput = {
      description,
      requester: "Usuario interno",
      source: "chat",
    };
    let ticket = inferTicket(description, tickets.length, effectivePriority);
    let storedRemotely = false;

    setMessages((current) => [
      ...current,
      { author: "user", text: description },
      agentMessage(`1/3 Recibi tu solicitud. Voy a clasificar el caso con prioridad ${effectivePriority}.`),
    ]);

    try {
      setTicketAction({ kind: "creating", label: "Creando ticket" });
      setNotice({ kind: "warning", text: "Creando ticket y clasificando con IA..." });
      const response = await fetch("/api/tickets", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo crear el ticket.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      ticket = result.data;
      storedRemotely = true;
      setMessages((current) => [
        ...current,
        agentMessage(`2/3 Ticket ${ticket.id} creado y clasificado como ${ticket.priority}.`),
      ]);
    } catch {
      setNotice({ kind: "warning", text: "API no disponible. Se creo un ticket local para no detener la operacion." });
      setMessages((current) => [
        ...current,
        agentMessage("2/3 API no disponible. Use la copia local para no interrumpir la operacion."),
      ]);
    }

    setTickets((current) => [ticket, ...current]);
    setSelectedId(ticket.id);
    const knowledgeSuggestion = suggestKnowledgeArticle(initialKnowledgeArticles, description);
      setMessages((current) => [
        ...current,
        agentMessage(
          knowledgeSuggestion
            ? `3/3 Sugerencia RAG: ${knowledgeSuggestion.id} · ${knowledgeSuggestion.title} (${knowledgeSuggestion.qualityScore}% calidad).`
            : "3/3 Ticket listo para sincronizar con GLPI.",
        ),
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
    setTicketAction({ kind: "idle" });
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

  function applyTemplate(template: QuickTemplate) {
    if (!canCreateTicket || actionBusy) return;

    setDraft(template.text);
    setNotice({ kind: "success", text: `Plantilla cargada: ${template.label}. Puedes enviarla o editarla.` });
  }

  async function updateSelected(status: TicketStatus, owner: string) {
    if (!selectedTicket) return;

    const payload: UpdateTicketInput = { owner, status };
    const previousTicket = selectedTicket;
    let storedRemotely = false;

    try {
      setTicketAction({ kind: "updating", label: `Actualizando ${status}` });
      setNotice({ kind: "warning", text: `Aplicando cambio a ${selectedTicket.id}...` });
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo actualizar el ticket.") });
        setTicketAction({ kind: "idle" });
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
    setTicketAction({ kind: "idle" });
  }

  async function syncSelectedWithGlpi() {
    if (!selectedTicket) return;

    let externalRef = selectedTicket.externalRef;

    try {
      setTicketAction({ kind: "syncing", label: "Sincronizando GLPI" });
      setNotice({ kind: "warning", text: `Sincronizando ${selectedTicket.id} con GLPI...` });
      const response = await fetch("/api/integrations/glpi/sync", {
        body: JSON.stringify({ ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo sincronizar con GLPI.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: Ticket };
      externalRef = result.data.externalRef;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API GLPI. La referencia no fue cambiada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setTickets((current) =>
      current.map((ticket) => (ticket.id === selectedTicket.id ? { ...ticket, externalRef } : ticket)),
    );

    void appendAudit(selectedTicket.id, "GLPI Adapter", "Sincronizacion solicitada", `Referencia operacional ${externalRef}.`);
    setNotice({ kind: "success", text: `${selectedTicket.id} sincronizado con referencia ${externalRef}.` });
    setTicketAction({ kind: "idle" });
  }

  async function pullSelectedFromGlpi() {
    if (!selectedTicket) return;

    try {
      setTicketAction({ kind: "syncing", label: "Actualizando desde GLPI" });
      setNotice({ kind: "warning", text: `Recibiendo cambios de GLPI para ${selectedTicket.id}...` });
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
      setTicketAction({ kind: "idle" });
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API GLPI para traer cambios." });
      setTicketAction({ kind: "idle" });
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
      setTicketAction({ kind: "remote", label: "Preparando RustDesk" });
      setNotice({ kind: "warning", text: `Preparando sesión RustDesk para ${selectedTicket.id}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo preparar RustDesk.") });
        setTicketAction({ kind: "idle" });
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
    setTicketAction({ kind: "idle" });
  }

  async function sendRemoteInvite() {
    if (!remoteSession) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Invitacion enviada" };

    try {
      setTicketAction({ kind: "remote", label: "Enviando invitación" });
      setNotice({ kind: "warning", text: `Enviando invitación RustDesk ${remoteSession.code}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Invitacion enviada" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo enviar la invitacion RustDesk.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API RustDesk. La invitacion no fue marcada como enviada." });
      setTicketAction({ kind: "idle" });
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
    setTicketAction({ kind: "idle" });
  }

  async function grantRemoteConsent() {
    if (!remoteSession) return;

    const consentGrantedAt = new Date().toISOString();
    let updatedSession: RemoteSupportSession = { ...remoteSession, consentGrantedAt };

    try {
      setTicketAction({ kind: "remote", label: "Registrando consentimiento" });
      setNotice({ kind: "warning", text: `Registrando consentimiento para ${remoteSession.code}...` });
      const response = await fetch("/api/integrations/rustdesk/consent", {
        body: JSON.stringify({ decision: "approve", token: remoteSession.consentToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo registrar el consentimiento.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      updatedSession = { ...updatedSession, consentGrantedAt };
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API de consentimiento. La aprobacion no fue registrada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "Usuario", "Consentimiento RustDesk aprobado", `Sesion ${updatedSession.code}.`);
    setNotice({ kind: "success", text: `Consentimiento registrado para ${updatedSession.code}.` });
    setTicketAction({ kind: "idle" });
  }

  async function connectRemoteSession() {
    if (!remoteSession || !remoteSession.consentGrantedAt) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Conectado" };

    try {
      setTicketAction({ kind: "remote", label: "Conectando RustDesk" });
      setNotice({ kind: "warning", text: `Conectando RustDesk ${remoteSession.code}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Conectado" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo conectar RustDesk.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API RustDesk. La sesion no fue conectada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "RustDesk", "Sesion remota conectada", `Conexion autorizada con codigo ${updatedSession.code}.`);
    setNotice({ kind: "success", text: `Sesion ${updatedSession.code} conectada.` });
    setTicketAction({ kind: "idle" });
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
          {actionLabel ? <span className="badge warning">{actionLabel}</span> : null}
        </div>
        {selectedTicket ? (
          <>
            <div className="ticketExecutive">
              <div>
                <span>Estado</span>
                <strong>{selectedTicket.status}</strong>
              </div>
              <div>
                <span>Responsable</span>
                <strong>{selectedTicket.owner}</strong>
              </div>
              <div>
                <span>Auditoria</span>
                <strong>{selectedAuditCount}</strong>
              </div>
              <p>
                {selectedTicket.id} mantiene trazabilidad activa con {selectedRemoteState.toLowerCase()} y {selectedTicket.confidence}% de confianza IA.
              </p>
            </div>
            <div className="copilotPanel">
              <strong>{selectedTicket.id}: {selectedTicket.title}</strong>
              <p>{selectedTicket.aiSummary}</p>
              {notice ? <p className={`consoleNotice ${notice.kind}`} role="status">{notice.text}</p> : null}
              {actionBusy ? <p className="permissionHint">Operando: {actionLabel?.toLowerCase()}.</p> : null}
              <div className="ticketJourney" aria-label="Progreso del ticket">
                <span className="badge">{ticketProgressStep}</span>
                <span className={selectedTicket.externalRef === "Pendiente GLPI" ? "badge warning" : "badge"}>{selectedTicket.externalRef}</span>
                <span className="badge">IA {selectedTicket.confidence}%</span>
                <span className="badge">{selectedTicket.status}</span>
              </div>
              <div className="ticketTimeline" aria-label="Cronologia del ticket">
                {ticketTimeline.map((step, index) => (
                  <div className={`ticketTimelineStep ${step.tone}`} key={step.label}>
                    <span className="ticketTimelineDot">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ticketMeta">
                <span className={priorityClass(selectedTicket.priority)}>{selectedTicket.priority}</span>
                <span className="badge">Confianza {selectedTicket.confidence}%</span>
                <span className="badge">{selectedTicket.category}</span>
                <span className="badge">{selectedTicket.owner}</span>
              </div>
              {ticketNextStep ? (
                <div className={`ticketWorkflowCallout ${ticketNextStep.tone}`}>
                  <span>Siguiente paso sugerido</span>
                  <strong>{ticketNextStep.label}</strong>
                  <p>{ticketNextStep.detail}</p>
                </div>
              ) : null}
              {canUpdateTicket || canSyncGlpi || canUseRustDesk ? (
                <div className="actionStack">
                  {ticketWorkflowSteps.map((step) => (
                    <button
                      className={step.tone === "ready" ? "primary" : ""}
                      disabled={!canUpdateTicket || actionBusy}
                      key={step.label}
                      onClick={() => void updateSelected(step.status, step.owner)}
                      type="button"
                    >
                      {step.label}
                    </button>
                  ))}
                  <button disabled={!canSyncGlpi || actionBusy} onClick={() => void syncSelectedWithGlpi()} type="button">Sincronizar GLPI</button>
                  <button disabled={!canPullGlpi || actionBusy} onClick={() => void pullSelectedFromGlpi()} type="button">Actualizar desde GLPI</button>
                  <button disabled={!canUseRustDesk || actionBusy} onClick={startRemoteSession} type="button">Sesion RustDesk</button>
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
                  <button className="primary" disabled={remoteSession.status !== "Esperando consentimiento" || actionBusy} onClick={() => void sendRemoteInvite()} type="button">Enviar invitacion</button>
                  <button disabled={Boolean(remoteSession.consentGrantedAt) || actionBusy} onClick={() => void grantRemoteConsent()} type="button">Registrar consentimiento</button>
                  <button disabled={!remoteSession.consentGrantedAt || remoteSession.status === "Conectado" || actionBusy} onClick={() => void connectRemoteSession()} type="button">Conectar</button>
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
            <h2>Historial de cambios</h2>
          </div>
          {selectedTicket ? <span className="badge">{selectedAudit.length} eventos · {selectedTicket.id}</span> : null}
        </div>
        <p className="topbarLead">
          Cada cambio queda registrado con el antes y despues de estado, responsable, prioridad o referencia GLPI.
        </p>
        <div className="timeline">
          {!canReadAudit ? (
            <p className="emptyState">La auditoria interna esta reservada para analistas y administradores.</p>
          ) : selectedAudit.length ? (
            selectedAudit.map((event) => (
              <div key={event.id}>
                <strong>{event.actor} · {event.action}</strong>
                <p>{event.detail}</p>
                <span>{formatUtcTime(event.at)}</span>
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
          <div className="chatJourney">
            <span>Ticket</span>
            <strong>{selectedTicket?.id ?? "Sin seleccionar"}</strong>
            <small>{actionBusy ? `${ticketProgressStep} · ${actionLabel}` : "Flujo listo para nueva solicitud"}</small>
          </div>
          <div className="quickTemplateRow" aria-label="Plantillas rapidas de ticket">
            {quickTemplates.map((template) => (
              <button
                className="quickTemplateButton"
                disabled={!canCreateTicket || actionBusy}
                key={template.label}
                onClick={() => applyTemplate(template)}
                type="button"
              >
                <strong>{template.label}</strong>
                <span>{template.text}</span>
              </button>
            ))}
          </div>
          {ticketSignal ? (
            <div className={`ticketSignal ${ticketSignalTone}`}>
              <span>Preclasificacion IA</span>
              <strong>{ticketSignal.category}</strong>
              <small>Prioridad sugerida: {ticketDraftPriority} · {ticketSignal.confidence}% confianza</small>
              <p>{ticketSignal.summary}</p>
              <em>Siguiente accion: {ticketSignal.action}.</em>
            </div>
          ) : null}
          {messages.map((message, index) => (
            <p className={message.author === "user" ? "userBubble" : ""} key={`${message.author}-${index}`}>{message.text}</p>
          ))}
        </div>
        <form className="chatComposer" onSubmit={submitTicket}>
          <input disabled={!canCreateTicket || actionBusy} onChange={(event) => setDraft(event.target.value)} placeholder={canCreateTicket ? "Describe el incidente..." : "El rol actual no puede crear tickets"} value={draft} />
          <div className="priorityField">
            <span>{draftPriority === "Sugerida" ? "Sugerida por IA" : "Editada manualmente"}</span>
            <select className={draftPriority === "Sugerida" ? "prioritySelect auto" : "prioritySelect manual"} aria-label="Prioridad sugerida" disabled={!canCreateTicket || actionBusy} onChange={(event) => setDraftPriority(event.target.value as TicketPriority | "Sugerida")} value={draftPriority}>
            <option value="Sugerida">Sugerida</option>
            <option value="Critica">Critica</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            </select>
          </div>
          <button className="primary" disabled={isPending || !canCreateTicket || actionBusy} type="submit">{actionLabel ?? (isPending ? "Creando..." : "Crear ticket")}</button>
          <span className={`chatComposerHint ${draftPriority === "Sugerida" ? "auto" : "manual"}`}>
            {draftPriority === "Sugerida" ? "IA" : "Manual"} · Prioridad sugerida: {ticketSignal?.priority ?? "Media"} · Prioridad seleccionada: {ticketDraftPriority} · Modo {ticketPriorityMode}
          </span>
        </form>
        {!canCreateTicket ? <p className="permissionHint">Accion bloqueada para {session.role}: cambia a Usuario o Admin para simular creacion de tickets.</p> : null}
      </article>
    </>
  );
}
