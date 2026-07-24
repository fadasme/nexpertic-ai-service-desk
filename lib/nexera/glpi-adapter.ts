import type { Ticket, TicketPriority, TicketStatus, UpdateTicketInput } from "./contracts";

export type GlpiSyncResult = {
  externalRef: string;
  mode: "configured" | "not_configured";
  status: "synced" | "queued" | "failed";
  message: string;
  operation: "create" | "pull" | "update" | "queue";
  attempts?: number;
  updates?: UpdateTicketInput;
};

type GlpiConfig = {
  appToken?: string;
  baseUrl?: string;
  userToken?: string;
};

function getGlpiConfig(): GlpiConfig {
  return {
    appToken: process.env.GLPI_APP_TOKEN,
    baseUrl: process.env.GLPI_BASE_URL,
    userToken: process.env.GLPI_USER_TOKEN,
  };
}

function glpiTimeoutMs() {
  const configuredTimeout = Number(process.env.GLPI_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 8000;
}

function glpiMaxRetries() {
  const configuredRetries = Number(process.env.GLPI_MAX_RETRIES);
  return Number.isInteger(configuredRetries) && configuredRetries >= 0 ? configuredRetries : 1;
}

function apiUrl(config: GlpiConfig, path: string) {
  const baseUrl = config.baseUrl?.replace(/\/$/, "");
  return `${baseUrl}/apirest.php/${path.replace(/^\//, "")}`;
}

function glpiHeaders(config: GlpiConfig, sessionToken?: string) {
  return {
    "App-Token": config.appToken ?? "",
    "Content-Type": "application/json",
    ...(sessionToken ? { "Session-Token": sessionToken } : {}),
  };
}

function buildFallbackRef(ticketId: string) {
  const numeric = ticketId.replace(/\D/g, "") || String(Date.now()).slice(-5);
  return `GLPI-PENDING-${numeric}`;
}

export function getGlpiStatus() {
  const config = getGlpiConfig();
  const configured = Boolean(config.baseUrl && config.appToken && config.userToken);

  return {
    configured,
    mode: configured ? "configured" : "not_configured",
    endpoints: configured ? ["initSession", "Ticket", "killSession"] : [],
    requiredEnv: ["GLPI_BASE_URL", "GLPI_APP_TOKEN", "GLPI_USER_TOKEN"],
    timeoutMs: glpiTimeoutMs(),
    maxRetries: glpiMaxRetries(),
  };
}

function isTransientStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function sanitizeGlpiError(operation: string, status: number) {
  return `GLPI ${operation} failed with HTTP ${status}`;
}

async function glpiFetch(config: GlpiConfig, path: string, init: RequestInit & { operation: string }, options: { retry?: boolean } = {}) {
  const maxAttempts = options.retry === false ? 1 : glpiMaxRetries() + 1;
  let lastError: Error | undefined;
  const { operation, ...requestInit } = init;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), glpiTimeoutMs());

    try {
      const response = await fetch(apiUrl(config, path), {
        ...requestInit,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(sanitizeGlpiError(operation, response.status));
        if (attempt < maxAttempts && isTransientStatus(response.status)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      return {
        attempts: attempt,
        response,
      };
    } catch (error) {
      const nextError = error instanceof Error && error.name === "AbortError"
        ? new Error(`GLPI ${operation} timed out after ${glpiTimeoutMs()}ms`)
        : error instanceof Error
          ? error
          : new Error(`GLPI ${operation} failed`);

      if (attempt < maxAttempts) {
        lastError = nextError;
        continue;
      }
      throw nextError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`GLPI ${operation} failed`);
}

async function initSession(config: GlpiConfig) {
  const { response } = await glpiFetch(config, "initSession", {
    headers: {
      ...glpiHeaders(config),
      Authorization: `user_token ${config.userToken}`,
    },
    method: "GET",
    operation: "initSession",
  });

  const payload = (await response.json()) as { session_token?: string };
  if (!payload.session_token) {
    throw new Error("GLPI initSession did not return session_token");
  }

  return payload.session_token;
}

async function killSession(config: GlpiConfig, sessionToken: string) {
  await glpiFetch(config, "killSession", {
    headers: glpiHeaders(config, sessionToken),
    method: "GET",
    operation: "killSession",
  }, { retry: false }).catch(() => undefined);
}

function glpiTicketId(externalRef: string) {
  const match = externalRef.match(/^GLPI-(\d+)$/);
  return match?.[1];
}

function ticketPayload(ticket: Ticket) {
  return {
    input: {
      content: ticket.aiSummary,
      name: ticket.title,
      priority: ticket.priority === "Critica" ? 5 : ticket.priority === "Alta" ? 4 : 3,
      status: ticket.status === "Resuelto" ? 6 : ticket.status === "Escalado" ? 3 : 2,
    },
  };
}

type GlpiTicketResponse = {
  id?: number;
  name?: string;
  priority?: number;
  status?: number;
  users_id_lastupdater?: number;
};

function priorityFromGlpi(priority?: number): TicketPriority | undefined {
  if (!priority) return undefined;
  if (priority >= 5) return "Critica";
  if (priority >= 4) return "Alta";
  return "Media";
}

function statusFromGlpi(status?: number): TicketStatus | undefined {
  switch (status) {
    case 1:
      return "Nuevo";
    case 2:
      return "Asignado";
    case 3:
      return "En diagnostico";
    case 4:
      return "Pendiente usuario";
    case 5:
      return "Resuelto";
    case 6:
      return "Resuelto";
    default:
      return undefined;
  }
}

async function createGlpiTicket(config: GlpiConfig, sessionToken: string, ticket: Ticket) {
  const { attempts, response } = await glpiFetch(config, "Ticket", {
    body: JSON.stringify(ticketPayload(ticket)),
    headers: glpiHeaders(config, sessionToken),
    method: "POST",
    operation: "Ticket create",
  });

  const payload = (await response.json()) as { id?: number };
  if (!payload.id) {
    throw new Error("GLPI Ticket create did not return id");
  }

  return { attempts, externalRef: `GLPI-${payload.id}` };
}

async function updateGlpiTicket(config: GlpiConfig, sessionToken: string, ticket: Ticket, id: string) {
  const { attempts } = await glpiFetch(config, `Ticket/${id}`, {
    body: JSON.stringify(ticketPayload(ticket)),
    headers: glpiHeaders(config, sessionToken),
    method: "PUT",
    operation: "Ticket update",
  });

  return { attempts, externalRef: `GLPI-${id}` };
}

async function getGlpiTicket(config: GlpiConfig, sessionToken: string, id: string) {
  const { attempts, response } = await glpiFetch(config, `Ticket/${id}`, {
    headers: glpiHeaders(config, sessionToken),
    method: "GET",
    operation: "Ticket pull",
  });
  const payload = (await response.json()) as GlpiTicketResponse;
  const updates: UpdateTicketInput = {};
  const status = statusFromGlpi(payload.status);
  const priority = priorityFromGlpi(payload.priority);

  if (status) updates.status = status;
  if (priority) updates.priority = priority;

  return {
    attempts,
    externalRef: `GLPI-${id}`,
    updates,
  };
}

export async function syncTicketWithGlpi(ticket: Ticket): Promise<GlpiSyncResult> {
  const config = getGlpiConfig();
  const status = getGlpiStatus();

  if (!status.configured) {
    return {
      externalRef: ticket.externalRef === "Pendiente GLPI" ? buildFallbackRef(ticket.id) : ticket.externalRef,
      mode: "not_configured",
      operation: "queue",
      status: "queued",
      message: "GLPI credentials are not configured. Ticket remains queued for external sync.",
    };
  }

  let sessionToken: string | undefined;

  try {
    sessionToken = await initSession(config);
    const existingId = glpiTicketId(ticket.externalRef);
    const syncResult = existingId
      ? await updateGlpiTicket(config, sessionToken, ticket, existingId)
      : await createGlpiTicket(config, sessionToken, ticket);

    return {
      attempts: syncResult.attempts,
      externalRef: syncResult.externalRef,
      mode: "configured",
      operation: existingId ? "update" : "create",
      status: "synced",
      message: existingId ? "Ticket updated in GLPI." : "Ticket created in GLPI.",
    };
  } catch (error) {
    return {
      externalRef: ticket.externalRef === "Pendiente GLPI" ? buildFallbackRef(ticket.id) : ticket.externalRef,
      mode: "configured",
      operation: "queue",
      status: "failed",
      message: error instanceof Error ? error.message : "GLPI sync failed.",
    };
  } finally {
    if (sessionToken) {
      await killSession(config, sessionToken);
    }
  }
}

export async function pullTicketFromGlpi(ticket: Ticket): Promise<GlpiSyncResult> {
  const config = getGlpiConfig();
  const status = getGlpiStatus();
  const existingId = glpiTicketId(ticket.externalRef);

  if (!status.configured) {
    return {
      externalRef: ticket.externalRef,
      mode: "not_configured",
      operation: "queue",
      status: "queued",
      message: "GLPI credentials are not configured. Ticket cannot be pulled yet.",
    };
  }

  if (!existingId) {
    return {
      externalRef: ticket.externalRef,
      mode: "configured",
      operation: "pull",
      status: "failed",
      message: "Ticket does not have a valid GLPI external reference.",
    };
  }

  let sessionToken: string | undefined;

  try {
    sessionToken = await initSession(config);
    const result = await getGlpiTicket(config, sessionToken, existingId);

    return {
      attempts: result.attempts,
      externalRef: result.externalRef,
      mode: "configured",
      operation: "pull",
      status: "synced",
      updates: result.updates,
      message: Object.keys(result.updates).length
        ? "Ticket pulled from GLPI."
        : "Ticket pulled from GLPI without mapped changes.",
    };
  } catch (error) {
    return {
      externalRef: ticket.externalRef,
      mode: "configured",
      operation: "pull",
      status: "failed",
      message: error instanceof Error ? error.message : "GLPI pull failed.",
    };
  } finally {
    if (sessionToken) {
      await killSession(config, sessionToken);
    }
  }
}
