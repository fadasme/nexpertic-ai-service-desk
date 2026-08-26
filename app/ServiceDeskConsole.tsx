"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { suggestKnowledgeArticle } from "@/lib/nexera/knowledge-search";
import { formatUtcTime } from "@/lib/nexera/time-format";
import { getTicketWorkflowSteps, suggestNextTicketStep } from "@/lib/nexera/ticket-workflow";
import type { AuditEvent, CreateAuditEventInput, CreateTicketInput, KnowledgeArticle, RemoteSupportSession, SessionUser, Ticket, TicketPriority, TicketStatus, TicketTemplate, UpdateTicketInput } from "@/lib/nexera/contracts";

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

type ClarificationPrompt = {
  label: string;
  text: string;
};

type GlpiStatusSnapshot = {
  configured: boolean;
  maxRetries: number;
  requiredEnv: string[];
  timeoutMs: number;
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

function ticketAvatar(ticket: Ticket) {
  const token = [ticket.requester, ticket.owner, ticket.category].join(" ").toLowerCase();
  if (token.includes("usuario demo")) return "UD";
  if (token.includes("usuario operativo")) return "UO";
  if (token.includes("usuario interno")) return "UI";
  if (token.includes("mesa l1")) return "L1";
  return ticket.id.slice(-2);
}

function sourceLabel(source: Ticket["source"]) {
  if (source === "chat") return "Chat";
  if (source === "portal") return "Portal";
  if (source === "email") return "Email";
  return "API";
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

function buildClarificationPrompts(signal: TicketDraftSignal | null): ClarificationPrompt[] {
  if (!signal) {
    return [
      { label: "Contexto", text: "¿Desde cuándo ocurre el problema y a cuántos usuarios afecta?" },
      { label: "Impacto", text: "¿Qué proceso de trabajo se ve bloqueado o degradado?" },
      { label: "Evidencia", text: "¿Puedes compartir captura, mensaje de error o codigo exacto?" },
    ];
  }

  if (signal.category === "Identidad") {
    return [
      { label: "Acceso", text: "¿El fallo ocurre en correo, portal o ambos?" },
      { label: "MFA", text: "¿Te aparece un error de MFA o bloqueo condicional?" },
      { label: "Alcance", text: "¿El problema afecta a un usuario o a varios?" },
    ];
  }

  if (signal.category === "Conectividad") {
    return [
      { label: "Red", text: "¿La conexion falla solo en oficina, remoto o en ambos contextos?" },
      { label: "VPN", text: "¿La caida ocurre al conectar, autenticar o tras algunos minutos?" },
      { label: "Impacto", text: "¿Afecta solo a la VPN o tambien a otros sistemas internos?" },
    ];
  }

  if (signal.category === "Endpoint") {
    return [
      { label: "Equipo", text: "¿Es notebook o desktop y desde cuando notas la lentitud?" },
      { label: "Sintomas", text: "¿La lentitud aparece al iniciar, abrir apps o navegar?" },
      { label: "Uso", text: "¿El equipo muestra disco, RAM o CPU al 100%?" },
    ];
  }

  if (signal.category === "Seguridad") {
    return [
      { label: "Indicador", text: "¿Que alerta, correo o bloqueo disparo la sospecha?" },
      { label: "Urgencia", text: "¿Hay riesgo para credenciales, datos o continuidad?" },
      { label: "Evidencia", text: "¿Puedes adjuntar mensajes, remitentes o capturas?" },
    ];
  }

  return [
    { label: "Detalle", text: "¿Puedes describir el comportamiento exacto y el resultado esperado?" },
    { label: "Tiempo", text: "¿Desde cuando ocurre y con que frecuencia?" },
    { label: "Accion", text: "¿Que intentaste antes de reportarlo?" },
  ];
}

function buildStructuredDraft(
  signal: TicketDraftSignal | null,
  prompts: ClarificationPrompt[],
  priority: TicketPriority,
  currentDraft: string,
) {
  const baseTitle = signal?.category ?? "General";
  const intro = currentDraft.trim() || `Solicitud relacionada con ${baseTitle.toLowerCase()}.`;
  const promptLines = prompts.map((prompt) => `- ${prompt.label}: ${prompt.text}`).join("\n");
  const classificationLine = signal
    ? `Clasificacion sugerida: ${signal.category} · Prioridad ${priority} · ${signal.confidence}% confianza.`
    : "Clasificacion sugerida pendiente de analisis.";
  const actionLine = signal?.action ?? "Clasificar manualmente";

  return [
    `Asunto sugerido: ${actionLine}.`,
    intro,
    "",
    classificationLine,
    `Siguiente accion IA: ${actionLine}.`,
    "",
    "Datos a confirmar:",
    promptLines,
  ].join("\n");
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? fallback;
}

function buildGlpiNote(ticket: Ticket, nextStep: TicketWorkflowStep | null, remoteSession: RemoteSupportSession | null) {
  const nextStepText = nextStep ? `${nextStep.label.toLowerCase()} como proximo movimiento` : "mantener seguimiento manual";
  const remoteState = remoteSession
    ? remoteSession.consentGrantedAt
      ? "la sesion remota ya esta habilitada"
      : "la sesion remota aun espera consentimiento"
    : "no hay sesion remota abierta";

  return [
    `Ticket ${ticket.id}`,
    `Estado: ${ticket.status}`,
    `Responsable: ${ticket.owner}`,
    `Categoria: ${ticket.category}`,
    `Prioridad: ${ticket.priority}`,
    `Referencia GLPI: ${ticket.externalRef}`,
    `Resumen IA: ${ticket.aiSummary}`,
    `Siguiente accion: ${nextStepText}.`,
    `Contexto remoto: ${remoteState}.`,
  ].join(" | ");
}

function validateTicketDraft(description: string) {
  const normalized = description.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Escribe un problema o usa un borrador sugerido antes de crear el ticket.";
  }

  if (normalized.length < 12) {
    return "El ticket necesita más contexto. Agrega al menos un síntoma o impacto más claro.";
  }

  return null;
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
  const [savedTemplates, setSavedTemplates] = useState<TicketTemplate[]>([]);
  const [notice, setNotice] = useState<ConsoleNotice | null>(null);
  const [remoteSessions, setRemoteSessions] = useState<RemoteSupportSession[]>(initialRemoteSessions);
  const [ticketAction, setTicketAction] = useState<TicketActionState>({ kind: "idle" });
  const [glpiStatus, setGlpiStatus] = useState<GlpiStatusSnapshot | null>(null);
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
  const actionBusy = ticketAction.kind !== "idle";
  const actionLabel = ticketAction.kind === "idle" ? null : ticketAction.label;
  const ticketSignal = useMemo(() => previewTicketSignal(draft), [draft]);
  const clarificationPrompts = useMemo(() => buildClarificationPrompts(ticketSignal), [ticketSignal]);
  const ticketDraftPriority = draftPriority === "Sugerida" ? ticketSignal?.priority ?? "Media" : draftPriority;
  const structuredDraft = useMemo(
    () => buildStructuredDraft(ticketSignal, clarificationPrompts, ticketDraftPriority, draft),
    [clarificationPrompts, draft, ticketDraftPriority, ticketSignal],
  );
  const ticketDraftReady = Boolean(draft.trim() || structuredDraft.trim());
  const ticketSignalTone = ticketSignal ? (ticketSignal.priority === "Alta" ? "danger" : "warning") : "warning";
  const ticketPriorityMode = draftPriority === "Sugerida" ? "Automatica" : "Manual";

  useEffect(() => {
    fetch("/api/settings/templates").then(async (response) => {
      const payload = (await response.json()) as { data?: TicketTemplate[] };
      if (response.ok) setSavedTemplates(payload.data ?? []);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (draftPriority === "Sugerida") {
      setDraftPriority(ticketSignal?.priority ?? "Media");
    }
  }, [draftPriority, ticketSignal?.priority]);

  useEffect(() => {
    if (!draft.trim() || !ticketSignal || actionBusy) return;

    setMessages((current) => {
      const lastMessage = current[current.length - 1];
      const autoDraftMessage = `Borrador automatico: ${ticketSignal.category} · ${ticketSignal.action}.`;
      if (lastMessage?.author === "agent" && lastMessage.text === autoDraftMessage) {
        return current;
      }

      return [...current, agentMessage(autoDraftMessage)];
    });
  }, [actionBusy, draft, ticketSignal]);

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

  useEffect(() => {
    if (filteredTickets.length > 0 && !filteredTickets.some((ticket) => ticket.id === selectedId)) {
      const timer = window.setTimeout(() => setSelectedId(filteredTickets[0].id), 0);
      return () => window.clearTimeout(timer);
    }
  }, [filteredTickets, selectedId]);

  const ticketColumns = useMemo(() => {
    const columns = [
      {
        key: "Nuevo",
        match: (ticket: Ticket) => ticket.status === "Nuevo",
        status: "Nuevo",
      },
      {
        key: "En proceso",
        match: (ticket: Ticket) => ticket.status === "Asignado" || ticket.status === "En diagnostico",
        status: "En proceso",
      },
      {
        key: "Pendiente",
        match: (ticket: Ticket) => ticket.status === "Pendiente usuario" || ticket.status === "Escalado",
        status: "Pendiente",
      },
      {
        key: "Resuelto",
        match: (ticket: Ticket) => ticket.status === "Resuelto",
        status: "Resuelto",
      },
    ] as const;

    return columns
      .map((column) => ({
        count: filteredTickets.filter((ticket) => column.match(ticket)).length,
        status: column.status,
        tickets: filteredTickets.filter((ticket) => column.match(ticket)),
      }))
      .filter((column) => column.tickets.length > 0);
  }, [filteredTickets]);

  const ticketSummary = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ticket.status !== "Resuelto").length;
    const high = tickets.filter((ticket) => ticket.priority === "Alta" || ticket.priority === "Critica").length;
    const assigned = tickets.filter((ticket) => ticket.owner !== "Mesa L1").length;
    const remoteReady = remoteSessions.filter((sessionItem) => Boolean(sessionItem.consentGrantedAt)).length;

    return {
      assigned,
      high,
      open,
      remoteReady,
      total,
    };
  }, [remoteSessions, tickets]);

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
  const selectedGlpiState = selectedTicket
    ? selectedTicket.externalRef === "Pendiente GLPI"
      ? {
          badge: "Pendiente GLPI",
          detail: "Todavía no hay referencia externa. Puedes sincronizar ahora o dejar el caso solo en Nexpertic.",
          tone: "warning" as const,
        }
      : {
          badge: selectedTicket.externalRef,
          detail: `El ticket ya quedó enlazado con GLPI como ${selectedTicket.externalRef}.`,
          tone: "ok" as const,
      }
    : null;
  const selectedGlpiGuide = glpiStatus
    ? glpiStatus.configured
      ? {
          detail: `GLPI listo · timeout ${glpiStatus.timeoutMs}ms · reintentos ${glpiStatus.maxRetries}.`,
          tone: "ok" as const,
          title: "GLPI configurado",
        }
      : {
          detail: `Faltan ${glpiStatus.requiredEnv.join(", ")} para activar la sincronización.`,
          tone: "warning" as const,
          title: "GLPI no configurado",
        }
    : null;
  const copilotHints = selectedTicket
    ? [
        ticketNextStep ? `Siguiente paso: ${ticketNextStep.label.toLowerCase()}.` : "No hay un siguiente paso sugerido todavía.",
        selectedTicket.externalRef === "Pendiente GLPI"
          ? "Si el caso ya es de cliente, sincroniza con GLPI para abrir trazabilidad externa."
          : "GLPI ya tiene referencia; puedes actualizar estado o pedir pull de regreso.",
        remoteSession
          ? remoteSession.consentGrantedAt
            ? "La sesión remota ya tiene consentimiento; puedes conectar cuando corresponda."
            : "La sesión remota está creada pero aún falta consentimiento del usuario."
          : "No hay sesión remota activa para este ticket.",
      ]
    : [];
  const canCreateTicket = hasPermission(session, "ticket:create");
  const canUpdateTicket = hasPermission(session, "ticket:update");
  const canSyncGlpi = hasPermission(session, "ticket:sync-glpi");
  const glpiConfigured = glpiStatus?.configured ?? false;
  const canPullGlpi = canSyncGlpi && Boolean(selectedTicket?.externalRef.match(/^GLPI-\d+$/));
  const canUseRemoteSupport = hasPermission(session, "rustdesk:session");
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
  const ticketProgressStep = getTicketProgressStep(ticketAction.kind);
  const selectedTicketOverview = selectedTicket
    ? {
        statusLine: `${selectedTicket.status} · ${selectedTicket.owner} · IA ${selectedTicket.confidence}%`,
        summaryLine:
          selectedTicket.externalRef === "Pendiente GLPI"
            ? "Aun no existe referencia externa."
            : `Referencia externa ${selectedTicket.externalRef}.`,
      }
    : null;
  const selectedGlpiNote = selectedTicket ? buildGlpiNote(selectedTicket, ticketNextStep, remoteSession) : null;

  useEffect(() => {
    function onRoleChange(event: Event) {
      setSession((event as CustomEvent<SessionUser>).detail);
    }

    window.addEventListener("nexera:role-change", onRoleChange);
    return () => window.removeEventListener("nexera:role-change", onRoleChange);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadGlpiStatus() {
      try {
        const response = await fetch("/api/integrations/glpi/status", {
          headers: { "x-nexera-role": session.role },
        });

        if (!response.ok) return;

        const result = (await response.json()) as { data: GlpiStatusSnapshot };
        if (isActive) {
          setGlpiStatus(result.data);
        }
      } catch {
        // Keep the previous status if the API is unavailable.
      }
    }

    void loadGlpiStatus().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [session.role]);

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
    if (!selectedTicket || !canUseRemoteSupport) return;

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
  }, [canUseRemoteSupport, selectedTicket, session.role]);

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
    const validationError = validateTicketDraft(description);
    if (validationError) {
      setNotice({ kind: "warning", text: validationError });
      setMessages((current) => [...current, agentMessage(validationError)]);
      return;
    }

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
    if (!canCreateTicket || actionBusy) return;

    const description = draft.trim() || structuredDraft.trim();
    const validationError = validateTicketDraft(description);
    if (validationError) {
      setNotice({ kind: "warning", text: validationError });
      setMessages((current) => [...current, agentMessage(validationError)]);
      return;
    }

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

  function applyClarificationPrompt(prompt: ClarificationPrompt) {
    if (!canCreateTicket || actionBusy) return;

    setDraft((current) => (current.trim() ? `${current.trim()}\n${prompt.text}` : prompt.text));
    setNotice({ kind: "success", text: `Pregunta agregada: ${prompt.label}.` });
  }

  function generateDraftFromSignal() {
    if (!canCreateTicket || actionBusy) return;
    const suggestedPriority = ticketSignal?.priority ?? "Media";

    setDraft(structuredDraft);
    if (draftPriority === "Sugerida") {
      setDraftPriority(suggestedPriority);
    }
    setNotice({ kind: "success", text: "Borrador estructurado generado por el copiloto." });
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
        body: JSON.stringify({ note: selectedGlpiNote, ticketId: selectedTicket.id }),
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
    if (selectedGlpiNote) {
      void appendAudit(selectedTicket.id, "Agente IA", "Nota GLPI enviada", selectedGlpiNote);
    }
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

  async function runCopilotSummary() {
    if (!selectedTicket) return;

    const glpiNote = selectedGlpiNote ?? buildGlpiNote(selectedTicket, ticketNextStep, remoteSession);

    setMessages((current) => [
      ...current,
      agentMessage(`Resumen operativo para GLPI: ${glpiNote}`),
    ]);
    void appendAudit(selectedTicket.id, "Agente IA", "Nota operativa generada", glpiNote);
    setNotice({ kind: "success", text: "Resumen operativo agregado al chat del copiloto." });
  }

  async function copyCopilotNote() {
    if (!selectedTicket || !selectedGlpiNote) return;

    try {
      await navigator.clipboard.writeText(selectedGlpiNote);
      setNotice({ kind: "success", text: "Nota GLPI copiada al portapapeles." });
      return;
    } catch {
      setNotice({ kind: "warning", text: "No se pudo copiar automaticamente. Puedes seleccionar la nota en el chat." });
    }

    setMessages((current) => [
      ...current,
      agentMessage(`Nota GLPI para copiar: ${selectedGlpiNote}`),
    ]);
  }

  async function applySuggestedStep() {
    if (!selectedTicket || !ticketNextStep) return;

    setNotice({ kind: "warning", text: `Aplicando paso sugerido: ${ticketNextStep.label}.` });
    await updateSelected(ticketNextStep.status, ticketNextStep.owner);
  }

  async function startRemoteSession() {
    if (!selectedTicket) return;

    try {
      setTicketAction({ kind: "remote", label: "Preparando Soporte remoto" });
      setNotice({ kind: "warning", text: `Preparando sesión de soporte remoto para ${selectedTicket.id}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ ticketId: selectedTicket.id }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "POST",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo preparar Soporte remoto.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      const supportSession = result.data;
      setRemoteSessions((current) => mergeRemoteSession(current, supportSession));
      void appendAudit(
        selectedTicket.id,
        "Soporte remoto",
        "Sesión remota preparada",
        `Invitacion ${supportSession.code} preparada para ${selectedTicket.requester}. Requiere consentimiento del usuario antes de conectar.`,
      );
      setNotice({ kind: "success", text: `Sesión de soporte remoto ${supportSession.code} preparada.` });
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API Soporte remoto. Revisa el backend antes de continuar." });
      setTicketAction({ kind: "idle" });
      return;
    }
    setTicketAction({ kind: "idle" });
  }

  async function sendRemoteInvite() {
    if (!remoteSession) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Invitación enviada" };

    try {
      setTicketAction({ kind: "remote", label: "Enviando invitación" });
      setNotice({ kind: "warning", text: `Enviando invitación de soporte remoto ${remoteSession.code}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Invitación enviada" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo enviar la invitacion Soporte remoto.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API Soporte remoto. La invitacion no fue marcada como enviada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    setMessages((current) => [
      ...current,
      {
        author: "agent",
        text: `Invitacion Soporte remoto ${updatedSession.code} enviada al usuario. Expira en ${updatedSession.expiresInMinutes} minutos.`,
      },
    ]);
    void appendAudit(updatedSession.ticketId, "Soporte remoto", "Invitación enviada", `Codigo ${updatedSession.code}. Esperando consentimiento.`);
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
      setNotice({ kind: "error", text: "No se pudo contactar la API de autorización. La aprobación no fue registrada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "Usuario", "Autorización Soporte remoto aprobado", `Sesion ${updatedSession.code}.`);
    setNotice({ kind: "success", text: `Autorización registrado para ${updatedSession.code}.` });
    setTicketAction({ kind: "idle" });
  }

  async function connectRemoteSession() {
    if (!remoteSession || !remoteSession.consentGrantedAt) return;

    let updatedSession: RemoteSupportSession = { ...remoteSession, status: "Conectado" };

    try {
      setTicketAction({ kind: "remote", label: "Conectando soporte remoto" });
      setNotice({ kind: "warning", text: `Conectando soporte remoto ${remoteSession.code}...` });
      const response = await fetch("/api/integrations/rustdesk/session", {
        body: JSON.stringify({ id: remoteSession.id, status: "Conectado" }),
        headers: { "content-type": "application/json", "x-nexera-role": session.role },
        method: "PATCH",
      });

      if (!response.ok) {
        setNotice({ kind: "error", text: await responseError(response, "No se pudo conectar Soporte remoto.") });
        setTicketAction({ kind: "idle" });
        return;
      }

      const result = (await response.json()) as { data: RemoteSupportSession };
      updatedSession = result.data;
    } catch {
      setNotice({ kind: "error", text: "No se pudo contactar la API Soporte remoto. La sesion no fue conectada." });
      setTicketAction({ kind: "idle" });
      return;
    }

    setRemoteSessions((current) => mergeRemoteSession(current, updatedSession));
    void appendAudit(updatedSession.ticketId, "Soporte remoto", "Sesión remota conectada", `Conexion autorizada con codigo ${updatedSession.code}.`);
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

        <div className="pilotSummary" aria-label="Resumen operativo de tickets">
          <div className="ok">
            <span>Total</span>
            <strong>{ticketSummary.total}</strong>
          </div>
          <div className="warning">
            <span>Abiertos</span>
            <strong>{ticketSummary.open}</strong>
          </div>
          <div className="danger">
            <span>Alta/Critica</span>
            <strong>{ticketSummary.high}</strong>
          </div>
          <div className="ok">
            <span>Asignados</span>
            <strong>{ticketSummary.assigned}</strong>
          </div>
          <p>
            {ticketSummary.remoteReady
              ? `${ticketSummary.remoteReady} sesiones remotas ya tienen consentimiento y están listas para conectar.`
              : "Todavía no hay sesiones remotas listas para conectar con consentimiento."}
          </p>
        </div>

        <div className="roleLandingActions">
          <a className="buttonLike primary" href="#usuarios">
            Crear nuevo ticket
          </a>
          <a className="buttonLike" href="#api">
            Ver integraciones
          </a>
        </div>

        <div className="commandCenterGrid">
          <aside className="workspaceRail" aria-label="Navegacion interna de la consola">
            <div className="workspaceRailCard">
              <p className="eyebrow">Consola</p>
              <h3>Ruta operativa</h3>
              <p>Accede a la cola, la auditoria y el portal de usuarios sin salir del panel de trabajo.</p>
            </div>

            <nav className="workspaceRailNav">
              <a className="active" href="#command-center">
                <strong>Cola</strong>
                <span>Tickets, filtros y panel principal</span>
              </a>
              <a href="#usuarios">
                <strong>Usuarios</strong>
                <span>Chat, borradores y creación guiada</span>
              </a>
              <a href="#audit">
                <strong>Auditoria</strong>
                <span>Trazabilidad de cambios y responsables</span>
              </a>
            </nav>

            <div className="workspaceRailCard workspaceRailCardMuted">
              <p className="eyebrow">Accesos rapidos</p>
              <div className="workspaceRailLinks">
                <a href="#usuarios">Crear ticket</a>
                <a href="#audit">Ver auditoria</a>
                <a href="#command-center">Volver a la cola</a>
              </div>
            </div>
          </aside>

          <section className="consoleListPane">
            <div className="ticketWorkspaceBar">
              <div className="ticketWorkspaceTitle">
                <p className="eyebrow">Requests</p>
                <h3>All Requests</h3>
                <p className="ticketWorkspaceLead">Cola principal para clasificar, revisar y mover tickets sin ruido visual.</p>
              </div>
              <div className="ticketWorkspaceTools">
                <label className="ticketWorkspaceSearch">
                  <span>Buscar</span>
                  <input aria-label="Buscar ticket" onChange={(event) => setQuery(event.target.value)} placeholder="Ticket, usuario o categoría" value={query} />
                </label>
                <label className="ticketWorkspaceSelect">
                  <span>Prioridad</span>
                  <select aria-label="Filtrar prioridad" onChange={(event) => setPriority(event.target.value as TicketPriority | "Todas")} value={priority}>
                    <option>Todas</option>
                    <option>Critica</option>
                    <option>Alta</option>
                    <option>Media</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="ticketBoard">
              {ticketColumns.map((column) => (
              <div className={`ticketColumn ticketColumn-${column.status.toLowerCase().replace(/\s+/g, "-")}`} key={column.status}>
                  <div className="ticketColumnHeader">
                    <span>{column.status}</span>
                    <strong>{column.count}</strong>
                  </div>
                  <div className="ticketColumnList">
                    {column.tickets.map((ticket) => (
                      <button className={`ticketCard ${ticket.id === selectedTicket?.id ? "selected" : ""}`} key={ticket.id} onClick={() => setSelectedId(ticket.id)} type="button">
                        <div className="ticketCardMain">
                          <div className="ticketTopline">
                            <div className="ticketIdentity">
                              <span className="ticketAvatar">{ticketAvatar(ticket)}</span>
                              <div>
                                <span className="ticketId">{ticket.id}</span>
                                <span className="ticketSource">{sourceLabel(ticket.source)}</span>
                              </div>
                            </div>
                            <div className="ticketToplinePills">
                              <span className="ticketStatusPill">{ticket.status}</span>
                              <span className={priorityClass(ticket.priority)}>{ticket.priority}</span>
                            </div>
                          </div>
                          <h3>{ticket.title}</h3>
                          <p>{ticket.aiSummary}</p>
                        </div>
                        <div className="ticketCardSide">
                          <div className="ticketMeta">
                            {!isSelfServiceUser ? <span>{ticket.requester}</span> : null}
                            <span>{ticket.owner}</span>
                            <span>{ticket.category}</span>
                            <span>IA {ticket.confidence}%</span>
                          </div>
                        </div>
                      </button>
                    ))}
                    {!column.tickets.length ? <p className="emptyState">{ticketPanelCopy.empty}</p> : null}
                  </div>
                </div>
              ))}
              {!ticketColumns.length ? <p className="emptyState">{ticketPanelCopy.empty}</p> : null}
            </div>
          </section>

          <section className="consoleDetailPane">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">{detailCopy.eyebrow}</p>
                <h2>{detailCopy.heading}</h2>
              </div>
              {actionLabel ? <span className="badge warning">{actionLabel}</span> : null}
            </div>
            {selectedTicket ? (
              <>
                <div className="ticketDetailGrid">
                  <div className="ticketDetailMain">
                    <div className="ticketDetailHero">
                      <div className="ticketIdentity">
                        <span className="ticketAvatar">{ticketAvatar(selectedTicket)}</span>
                        <div>
                          <span className="ticketId">{selectedTicket.id}</span>
                          <span className="ticketSource">{sourceLabel(selectedTicket.source)}</span>
                        </div>
                      </div>
                      <div className="ticketDetailHeroCopy">
                        <strong>{selectedTicket.title}</strong>
                        <p>{selectedTicket.aiSummary}</p>
                      </div>
                      <div className="ticketDetailHeroStats">
                        <span>
                          <strong>{selectedTicket.status}</strong>
                          <small>Estado</small>
                        </span>
                        <span>
                          <strong>{selectedTicket.priority}</strong>
                          <small>Prioridad</small>
                        </span>
                        <span>
                          <strong>{selectedTicket.confidence}%</strong>
                          <small>IA</small>
                        </span>
                      </div>
                    </div>
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
                      <p>{selectedTicket.id} mantiene trazabilidad activa con {selectedRemoteState.toLowerCase()} y {selectedTicket.confidence}% de confianza IA.</p>
                    </div>
                    <div className="copilotPanel">
                      <strong>
                        {selectedTicket.id}: {selectedTicket.title}
                      </strong>
                      <p>{selectedTicket.aiSummary}</p>
                      {copilotHints.length ? (
                        <div className="copilotHints" aria-label="Sugerencias del copiloto">
                          {copilotHints.map((hint) => (
                            <div key={hint}>
                              <span />
                              <p>{hint}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
                    </div>
                    {selectedTicketOverview ? (
                      <div className="ticketActionLane">
                        <div className="ticketActionCard">
                          <span>Lectura rapida</span>
                          <strong>{selectedTicketOverview.statusLine}</strong>
                          <p>{selectedTicketOverview.summaryLine}</p>
                        </div>
                        <div className="ticketActionCard">
                          <span>Copiloto operativo</span>
                          <strong>{ticketNextStep ? ticketNextStep.label : "Sin accion sugerida"}</strong>
                          <p>{ticketNextStep ? ticketNextStep.detail : "Este ticket no tiene un siguiente paso predefinido."}</p>
                        </div>
                      </div>
                    ) : null}
                    {selectedGlpiState ? (
                      <div className={`ticketWorkflowCallout ${selectedGlpiState.tone}`}>
                        <span>GLPI</span>
                        <strong>{selectedGlpiState.badge}</strong>
                        <p>{selectedGlpiState.detail}</p>
                      </div>
                    ) : null}
                    {selectedGlpiGuide ? (
                      <div className={`ticketWorkflowCallout ${selectedGlpiGuide.tone}`}>
                        <span>Estado GLPI</span>
                        <strong>{selectedGlpiGuide.title}</strong>
                        <p>{selectedGlpiGuide.detail}</p>
                      </div>
                    ) : null}
                    {selectedGlpiNote ? (
                      <div className="glpiNotePreview">
                        <span>Vista previa GLPI</span>
                        <strong>Nota operativa lista para copiar o enviar</strong>
                        <p>{selectedGlpiNote}</p>
                      </div>
                    ) : null}
                  </div>

                  <aside className="ticketDetailRail">
                    {ticketNextStep ? (
                      <div className={`ticketWorkflowCallout ${ticketNextStep.tone}`}>
                        <span>Siguiente paso sugerido</span>
                        <strong>{ticketNextStep.label}</strong>
                        <p>{ticketNextStep.detail}</p>
                      </div>
                    ) : null}
                    {canUpdateTicket || canSyncGlpi || canUseRemoteSupport ? (
                      <div className="actionStack">
                        <button
                          className="primary"
                          disabled={!canUpdateTicket || actionBusy || !ticketNextStep}
                          onClick={() => void applySuggestedStep()}
                          type="button"
                        >
                          Aplicar siguiente paso
                        </button>
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
                        <button disabled={actionBusy} onClick={() => void runCopilotSummary()} type="button">
                          Resumir caso
                        </button>
                        <button disabled={actionBusy} onClick={() => void copyCopilotNote()} type="button">
                          Copiar nota GLPI
                        </button>
                        <button disabled={!canSyncGlpi || !glpiConfigured || actionBusy} onClick={() => void syncSelectedWithGlpi()} type="button">
                          Sincronizar GLPI
                        </button>
                        <button disabled={!canPullGlpi || !glpiConfigured || actionBusy} onClick={() => void pullSelectedFromGlpi()} type="button">
                          Actualizar desde GLPI
                        </button>
                        <button disabled={!canUseRemoteSupport || actionBusy} onClick={startRemoteSession} type="button">
                          Sesión de soporte remoto
                        </button>
                      </div>
                    ) : (
                      <p className="permissionHint">Tu solicitud ya esta registrada. El equipo de soporte actualizara el estado y dejara trazabilidad visible cuando corresponda.</p>
                    )}
                    {canSyncGlpi && !glpiConfigured ? (
                      <p className="permissionHint">
                        GLPI todavía no está listo. Completa la configuración del backend antes de usar la sincronización.
                      </p>
                    ) : null}
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
                          <span>{remoteSession.consentGrantedAt ? "Autorización registrada" : "Autorización pendiente"}</span>
                          <span>{remoteSession.launchUrl}</span>
                        </div>
                        {remoteSession.consentToken.includes(".") ? (
                          <a className="consentLink" href={`/consentimiento-rustdesk?token=${remoteSession.consentToken}`} target="_blank" rel="noreferrer">
                            Abrir portal de autorización
                          </a>
                        ) : (
                          <span className="permissionHint">Portal de autorización disponible cuando la API firma el token.</span>
                        )}
                        <div className="actionStack">
                          <button className="primary" disabled={remoteSession.status !== "Esperando consentimiento" || actionBusy} onClick={() => void sendRemoteInvite()} type="button">
                            Enviar invitación
                          </button>
                          <button disabled={Boolean(remoteSession.consentGrantedAt) || actionBusy} onClick={() => void grantRemoteConsent()} type="button">
                            Registrar autorización
                          </button>
                          <button disabled={!remoteSession.consentGrantedAt || remoteSession.status === "Conectado" || actionBusy} onClick={() => void connectRemoteSession()} type="button">
                            Conectar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </aside>
                </div>
                </>
            ) : (
              <p className="emptyState">Selecciona o crea un ticket para activar el copiloto L2.</p>
            )}
          </section>
        </div>
      </article>

      <article className="panel" id="audit">
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
        <div className="userPortalGrid">
          <section className="chatStream">
            <div className="chatJourney">
              <span>Ticket</span>
              <strong>{selectedTicket?.id ?? "Sin seleccionar"}</strong>
              <small>{actionBusy ? `${ticketProgressStep} · ${actionLabel}` : "Flujo listo para nueva solicitud"}</small>
            </div>
            {messages.map((message, index) => (
              <p className={message.author === "user" ? "userBubble" : ""} key={`${message.author}-${index}`}>{message.text}</p>
            ))}
          </section>
          <aside className="chatRail">
            <div className="ticketComposerState" aria-label="Estado de preparación del ticket">
              <div className={ticketDraftReady ? "ready" : "pending"}>
                <span>{ticketDraftReady ? "Listo" : "Pendiente"}</span>
                <strong>{ticketDraftReady ? "Borrador preparado" : "Escribe o genera un borrador"}</strong>
              </div>
              <div className={ticketSignal ? "ready" : "pending"}>
                <span>{ticketSignal ? "IA" : "Contexto"}</span>
                <strong>{ticketSignal ? `Categoria ${ticketSignal.category}` : "Agrega contexto para clasificar"}</strong>
              </div>
              <div className={ticketDraftPriority !== "Sugerida" ? "ready" : "pending"}>
                <span>{ticketDraftPriority}</span>
                <strong>{ticketPriorityMode === "Automatica" ? "Prioridad sugerida" : "Prioridad manual"}</strong>
              </div>
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
            <div className="draftPreviewPanel" aria-label="Borrador sugerido del ticket">
              <span>Borrador sugerido</span>
              <strong>{ticketSignal ? `Asunto: ${ticketSignal.action}` : "Esperando contexto para sugerir un borrador"}</strong>
              <p>{structuredDraft}</p>
            </div>
            <div className="clarificationPanel" aria-label="Preguntas sugeridas para el ticket">
              <span>Preguntas sugeridas</span>
              <div className="clarificationGrid">
                {clarificationPrompts.map((prompt) => (
                  <button
                    className="clarificationButton"
                    disabled={!canCreateTicket || actionBusy}
                    key={prompt.label}
                    onClick={() => applyClarificationPrompt(prompt)}
                    type="button"
                  >
                    <strong>{prompt.label}</strong>
                    <p>{prompt.text}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <form className="chatComposer" onSubmit={submitTicket}>
          {savedTemplates.length ? <select aria-label="Usar plantilla" defaultValue="" disabled={!canCreateTicket || actionBusy} onChange={(event) => { const template = savedTemplates.find((item) => item.id === event.target.value); if (template) setDraft(`${template.subject}\n\n${template.body}`); }}><option value="">Usar plantilla...</option>{savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select> : null}
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
          <button disabled={!canCreateTicket || actionBusy} onClick={generateDraftFromSignal} type="button">
            Generar borrador
          </button>
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
