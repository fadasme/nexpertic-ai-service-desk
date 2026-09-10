import { hasConfiguredEnvValue } from "./runtime-config.ts";
import type { RemoteSupportSession, Ticket } from "./contracts";

type MailConfig = {
  from?: string;
  host?: string;
  password?: string;
  port: number;
  secure: boolean;
  user?: string;
};

type MailMessage = {
  html?: string;
  subject: string;
  text: string;
  to: string;
};

function smtpPort() {
  const configuredPort = Number(process.env.SMTP_PORT);
  return Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 465;
}

export function getMailConfig(): MailConfig {
  const port = smtpPort();
  return {
    from: process.env.SMTP_FROM,
    host: process.env.SMTP_HOST,
    password: process.env.SMTP_PASSWORD,
    port,
    secure: (process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true",
    user: process.env.SMTP_USER,
  };
}

export function getMailStatus() {
  const config = getMailConfig();
  const configured = hasConfiguredEnvValue(config.host)
    && hasConfiguredEnvValue(config.user)
    && hasConfiguredEnvValue(config.password)
    && hasConfiguredEnvValue(config.from);

  return {
    configured,
    mode: configured ? "configured" : "not_configured",
    provider: "cPanel SMTP",
    requiredEnv: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"],
    sender: hasConfiguredEnvValue(config.from) ? config.from : undefined,
  };
}

function publicUrl() {
  return (process.env.NEXERA_PUBLIC_URL ?? "https://servicedesk.nexera.cl").replace(/\/$/, "");
}

function encodeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

function mailBody(message: MailMessage, from: string) {
  const boundary = `nexpertic-${crypto.randomUUID()}`;
  const html = message.html ?? message.text.replaceAll("\n", "<br>");
  return [
    `From: ${encodeHeader(from)}`,
    `To: ${encodeHeader(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

class SmtpReader {
  private readonly decoder = new TextDecoder();
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer = "";

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
  }

  async line() {
    for (;;) {
      const lineBreak = this.buffer.search(/\r?\n/);
      if (lineBreak >= 0) {
        const line = this.buffer.slice(0, lineBreak);
        this.buffer = this.buffer.slice(lineBreak + (this.buffer[lineBreak] === "\r" ? 2 : 1));
        return line;
      }

      const { done, value } = await this.reader.read();
      if (done) {
        const remaining = this.buffer;
        this.buffer = "";
        return remaining;
      }

      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }
}

function smtpTimeoutMs() {
  const configured = Number(process.env.SMTP_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0 ? configured : 15_000;
}

async function withSmtpTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const limitMs = smtpTimeoutMs();
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`SMTP ${label} timed out after ${limitMs}ms`)), limitMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function expectSmtp(smtpReader: SmtpReader, accepted: number[]) {
  let line = await smtpReader.line();
  let code = Number(line.slice(0, 3));
  while (/^\d{3}-/.test(line)) {
    line = await smtpReader.line();
    code = Number(line.slice(0, 3));
  }
  if (!accepted.includes(code)) throw new Error(`SMTP unexpected response ${code || "unknown"}`);
  return line;
}

async function writeSmtp(writer: WritableStreamDefaultWriter<Uint8Array>, command: string) {
  await writer.write(new TextEncoder().encode(`${command}\r\n`));
}

async function sendViaSmtp(message: MailMessage, config: MailConfig) {
  const { connect } = await import("cloudflare:sockets");
  let socket = connect(
    { hostname: config.host ?? "", port: config.port },
    { allowHalfOpen: false, secureTransport: config.secure ? "on" : "starttls" },
  );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;

  try {
    await withSmtpTimeout(socket.opened, "connection");

    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();
    let smtpReader = new SmtpReader(reader);
    await withSmtpTimeout(expectSmtp(smtpReader, [220]), "greeting");
    await writeSmtp(writer, `EHLO ${publicUrl().replace(/^https?:\/\//, "")}`);
    await withSmtpTimeout(expectSmtp(smtpReader, [250]), "EHLO");

    if (!config.secure) {
      await writeSmtp(writer, "STARTTLS");
      await withSmtpTimeout(expectSmtp(smtpReader, [220]), "STARTTLS");
      writer.releaseLock();
      reader.releaseLock();
      writer = undefined;
      reader = undefined;
      socket = socket.startTls({ expectedServerHostname: config.host });
      await withSmtpTimeout(socket.opened, "TLS upgrade");
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
      smtpReader = new SmtpReader(reader);
      await writeSmtp(writer, `EHLO ${publicUrl().replace(/^https?:\/\//, "")}`);
      await withSmtpTimeout(expectSmtp(smtpReader, [250]), "EHLO after STARTTLS");
    }

    await writeSmtp(writer, "AUTH LOGIN");
    await withSmtpTimeout(expectSmtp(smtpReader, [334]), "AUTH LOGIN");
    await writeSmtp(writer, btoa(config.user ?? ""));
    await withSmtpTimeout(expectSmtp(smtpReader, [334]), "SMTP username");
    await writeSmtp(writer, btoa(config.password ?? ""));
    await withSmtpTimeout(expectSmtp(smtpReader, [235]), "SMTP password");
    await writeSmtp(writer, `MAIL FROM:<${config.from}>`);
    await withSmtpTimeout(expectSmtp(smtpReader, [250]), "MAIL FROM");
    await writeSmtp(writer, `RCPT TO:<${message.to}>`);
    await withSmtpTimeout(expectSmtp(smtpReader, [250, 251]), "RCPT TO");
    await writeSmtp(writer, "DATA");
    await withSmtpTimeout(expectSmtp(smtpReader, [354]), "DATA");
    await writeSmtp(writer, `${mailBody(message, config.from ?? "")}\r\n.`);
    await withSmtpTimeout(expectSmtp(smtpReader, [250]), "message delivery");
    await writeSmtp(writer, "QUIT");
  } finally {
    try { writer?.releaseLock(); } catch {}
    try { reader?.releaseLock(); } catch {}
    try { await socket.close(); } catch {}
  }
}

export async function sendMail(message: MailMessage) {
  const status = getMailStatus();
  if (!status.configured) {
    return { mode: status.mode, sent: false, reason: "SMTP is not configured" };
  }

  await sendViaSmtp(message, getMailConfig());
  return { mode: status.mode, sent: true };
}

export async function notifyTicketCreated(ticket: Ticket) {
  if (!ticket.requester.includes("@")) return { mode: "not_configured", sent: false, reason: "Requester has no email" };
  return sendMail({
    subject: `Ticket ${ticket.id} creado`,
    text: [
      `Tu ticket ${ticket.id} fue creado en Nexpertic AI Service Desk.`,
      `Estado: ${ticket.status}`,
      `Prioridad: ${ticket.priority}`,
      `Resumen: ${ticket.aiSummary}`,
      `Puedes revisarlo en ${publicUrl()}/tickets`,
    ].join("\n"),
    to: ticket.requester,
  });
}

export async function notifyRemoteSupportInvite(ticket: Ticket, session: RemoteSupportSession) {
  if (!ticket.requester.includes("@")) return { mode: "not_configured", sent: false, reason: "Requester has no email" };
  const consentUrl = `${publicUrl()}/consentimiento-rustdesk?token=${encodeURIComponent(session.consentToken)}`;
  return sendMail({
    subject: `Autorizacion de soporte remoto ${session.code}`,
    text: [
      `Soporte preparo una sesion remota para el ticket ${ticket.id}.`,
      `Codigo: ${session.code}`,
      `El enlace expira en ${session.expiresInMinutes} minutos.`,
      `Autoriza o rechaza la sesion aqui: ${consentUrl}`,
    ].join("\n"),
    to: ticket.requester,
  });
}
