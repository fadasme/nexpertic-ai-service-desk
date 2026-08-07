export type TicketPriority = "Critica" | "Alta" | "Media";

export type TicketStatus =
  | "Nuevo"
  | "Asignado"
  | "En diagnostico"
  | "Pendiente usuario"
  | "Escalado"
  | "Resuelto";

export type Ticket = {
  tenantId?: string;
  id: string;
  externalRef: string;
  title: string;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  owner: string;
  category: string;
  confidence: number;
  aiSummary: string;
  sla: "Critico" | "En riesgo" | "Normal";
  source: "chat" | "portal" | "email" | "api";
  createdAt: string;
};

export type CreateTicketInput = {
  tenantId?: string;
  description: string;
  requester?: string;
  source?: Ticket["source"];
};

export type UpdateTicketInput = Partial<Pick<Ticket, "status" | "owner" | "externalRef" | "priority">>;

export type Agent = {
  id: string;
  name: string;
  goal: string;
  tools: string[];
  score: string;
  humanApprovalRequired: boolean;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  domain: string;
  qualityScore: number;
  uses: number;
  status: "Validado" | "En revision";
  summary: string;
};

export type ExecutiveMetric = {
  label: string;
  value: string;
  detail: string;
};

export type AuditActor = "Usuario" | "Agente IA" | "Analista" | "GLPI Adapter" | "RustDesk";

export type AuditEvent = {
  tenantId?: string;
  id: string;
  ticketId: string;
  actor: AuditActor;
  action: string;
  detail: string;
  at: string;
};

export type CreateAuditEventInput = Pick<AuditEvent, "ticketId" | "actor" | "action" | "detail"> & { tenantId?: string };

export type RemoteSupportConnector = {
  id: string;
  provider: "RustDesk";
  mode: "OSS Self-hosted" | "Server Pro";
  status: "Disenado" | "Simulado" | "Conectado";
  capabilities: string[];
  securityControls: string[];
  launchPattern: string;
};

export type RemoteSupportSession = {
  tenantId?: string;
  id: string;
  ticketId: string;
  provider: "RustDesk";
  code: string;
  status: "Esperando consentimiento" | "Invitacion enviada" | "Conectado";
  expiresInMinutes: number;
  launchUrl: string;
  createdAt: string;
  consentExpiresAt: string;
  consentGrantedAt?: string;
  consentRejectedAt?: string;
  consentToken: string;
};

export type CreateRemoteSupportSessionInput = Pick<RemoteSupportSession, "ticketId"> & { tenantId?: string };

export type UpdateRemoteSupportSessionInput = Partial<Pick<RemoteSupportSession, "consentGrantedAt" | "consentRejectedAt" | "status">>;

export type SecurityEventSeverity = "info" | "warning" | "critical";

export type SecurityEvent = {
  tenantId?: string;
  id: string;
  action: string;
  at: string;
  detail: string;
  fingerprint?: string;
  severity: SecurityEventSeverity;
  source: "rustdesk-consent" | "auth" | "glpi" | "admin";
  ticketId?: string;
};

export type CreateSecurityEventInput = Omit<SecurityEvent, "at" | "id">;

export type UserRole = "Usuario" | "Analista" | "Ejecutivo" | "Admin";

export type UserAccountStatus = "Activo" | "Invitado" | "Suspendido";

export type UserAccount = {
  tenantId?: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant: string;
  status: UserAccountStatus;
  lastAccessAt?: string;
  permissions: string[];
};

export type UpdateUserRoleInput = {
  role: UserRole;
};

export type TenantConfig = {
  id: string;
  name: string;
  slug: string;
  status: "Activo" | "Piloto" | "Suspendido";
  region: string;
  features: {
    glpi: boolean;
    oidc: boolean;
    rustdesk: boolean;
  };
  policies: {
    demoDataAllowed: boolean;
    requireRemoteConsent: boolean;
    requireSso: boolean;
  };
  createdAt: string;
};

export type IdentityProviderConfig = {
  authorizationUrl?: string;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  issuer?: string;
  jwksUri?: string;
  mode: "not_configured" | "configured";
  provider: "Microsoft Entra ID" | "OIDC";
  redirectUri?: string;
  scopes: string[];
};

export type LocalAdminCredentials = {
  email: string;
  enabled: boolean;
};

export type OidcJwksStatus = {
  discoveryAvailable: boolean;
  error?: string;
  issuerConfigured: boolean;
  jwksAvailable: boolean;
  jwksKeyCount: number;
  jwksUriConfigured: boolean;
};

export type ExternalIdentityClaims = {
  email: string;
  externalId: string;
  groups?: string[];
  name: string;
  tenant?: string;
};

export type SecretPostureItem = {
  configured: boolean;
  devFallback?: boolean;
  key: string;
  label: string;
  risk: "ok" | "warning" | "critical";
};

export type SecretPosture = {
  items: SecretPostureItem[];
  mode: "ready" | "needs_attention";
  summary: {
    configured: number;
    critical: number;
    total: number;
    warnings: number;
  };
};

export type PilotReadinessStatus = "ready" | "warning" | "blocker";

export type PilotReadinessItem = {
  key: string;
  label: string;
  owner: "Arquitectura" | "Seguridad" | "Soporte" | "DevOps" | "Producto";
  status: PilotReadinessStatus;
  detail: string;
  action: string;
};

export type PilotReadiness = {
  items: PilotReadinessItem[];
  mode: "demo_ready" | "pilot_blocked" | "pilot_ready";
  nextActions: string[];
  score: number;
  summary: {
    blockers: number;
    ready: number;
    total: number;
    warnings: number;
  };
};

export type SessionUser = {
  tenantId?: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant: string;
  permissions: string[];
  expiresAt?: string;
};
