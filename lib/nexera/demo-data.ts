import type { Agent, ExecutiveMetric, KnowledgeArticle, RemoteSupportConnector, Ticket } from "./contracts";

export const tickets: Ticket[] = [
  {
    id: "NX-1042",
    externalRef: "GLPI-88231",
    title: "VPN no conecta despues de cambio de clave",
    requester: "Camila Torres",
    priority: "Alta",
    status: "En diagnostico",
    owner: "Mesa L1",
    category: "Conectividad",
    confidence: 87,
    aiSummary: "Validar perfil VPN, MFA y cambio reciente de credenciales.",
    sla: "En riesgo",
    source: "chat",
    createdAt: "2026-07-22T09:24:00-04:00",
  },
  {
    id: "NX-1041",
    externalRef: "GLPI-88229",
    title: "No puedo acceder a Microsoft 365",
    requester: "Javier Rojas",
    priority: "Critica",
    status: "Nuevo",
    owner: "Sin asignar",
    category: "Identidad",
    confidence: 91,
    aiSummary: "Revisar licencia, bloqueo condicional y estado en Entra ID.",
    sla: "Critico",
    source: "portal",
    createdAt: "2026-07-22T08:51:00-04:00",
  },
  {
    id: "NX-1039",
    externalRef: "GLPI-88214",
    title: "Notebook lento al iniciar jornada",
    requester: "Paula Mendez",
    priority: "Media",
    status: "Pendiente usuario",
    owner: "Soporte endpoint",
    category: "Endpoint",
    confidence: 78,
    aiSummary: "Solicitar telemetria basica y revisar aplicaciones de inicio.",
    sla: "Normal",
    source: "email",
    createdAt: "2026-07-21T16:35:00-04:00",
  },
];

export const agents: Agent[] = [
  {
    id: "agent-receptionist",
    name: "Recepcionista",
    goal: "Captura solicitudes y crea tickets completos.",
    tools: ["ticket.create", "knowledge.search", "user.lookup"],
    score: "99.2%",
    humanApprovalRequired: false,
  },
  {
    id: "agent-classifier",
    name: "Clasificador",
    goal: "Define categoria, impacto, urgencia y prioridad.",
    tools: ["ticket.update", "cmdb.lookup", "similarity.search"],
    score: "91%",
    humanApprovalRequired: false,
  },
  {
    id: "agent-l1",
    name: "Nivel 1",
    goal: "Resuelve incidentes repetitivos con conocimiento validado.",
    tools: ["knowledge.search", "ticket.comment", "ticket.resolve"],
    score: "31%",
    humanApprovalRequired: true,
  },
  {
    id: "agent-l2-copilot",
    name: "Copiloto L2",
    goal: "Resume contexto tecnico y sugiere causa probable.",
    tools: ["log.analyze", "knowledge.search", "ticket.summarize"],
    score: "84%",
    humanApprovalRequired: true,
  },
];

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    id: "KB-001",
    title: "VPN corporativa",
    domain: "Conectividad",
    qualityScore: 92,
    uses: 42,
    status: "Validado",
    summary: "Runbook validado para perfil, MFA y conectividad.",
  },
  {
    id: "KB-002",
    title: "Microsoft 365",
    domain: "Identidad",
    qualityScore: 89,
    uses: 37,
    status: "Validado",
    summary: "Recuperacion de acceso, licencias y bloqueo condicional.",
  },
  {
    id: "KB-003",
    title: "Notebook lento",
    domain: "Endpoint",
    qualityScore: 81,
    uses: 29,
    status: "En revision",
    summary: "Diagnostico endpoint, telemetria y limpieza segura.",
  },
];

export const executiveMetrics: ExecutiveMetric[] = [
  { label: "Costo evitado", value: "USD 8.4k", detail: "Estimado mensual" },
  { label: "Riesgo SLA", value: "Medio", detail: "3 servicios bajo observacion" },
  { label: "Madurez soporte", value: "2.7/5", detail: "Camino a gestion predictiva" },
];

export const remoteSupportConnectors: RemoteSupportConnector[] = [
  {
    id: "rustdesk-oss",
    provider: "RustDesk",
    mode: "OSS Self-hosted",
    status: "Simulado",
    capabilities: ["ID/relay propio", "Sesion remota asistida", "Control de datos on-prem"],
    securityControls: ["Consentimiento del usuario", "Registro en auditoria", "Aprobacion del analista"],
    launchPattern: "Generar invitacion o deep link operativo asociado al ticket Nexpertic.",
  },
  {
    id: "rustdesk-pro",
    provider: "RustDesk",
    mode: "Server Pro",
    status: "Disenado",
    capabilities: ["API/web console", "OIDC/LDAP/2FA", "Gestion centralizada de dispositivos"],
    securityControls: ["SSO empresarial", "RBAC por rol", "Politicas por tenant"],
    launchPattern: "Crear sesion desde conector Nexpertic y asociarla a GLPI/Nexpertic audit trail.",
  },
];
