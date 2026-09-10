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

async function readSmtpLine(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let output = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
    if (/\r?\n/.test(output)) break;
  }
  return output;
}

async function expectSmtp(reader: ReadableStreamDefaultReader<Uint8Array>, accepted: number[]) {
  let line = await readSmtpLine(reader);
  const code = Number(line.slice(0, 3));
  while (/^\d{3}-/.test(line)) {
    line = await readSmtpLine(reader);
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
  await socket.opened;

  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  await expectSmtp(reader, [220]);
  await writeSmtp(writer, `EHLO ${publicUrl().replace(/^https?:\/\//, "")}`);
  await expectSmtp(reader, [250]);

  if (!config.secure) {
    await writeSmtp(writer, "STARTTLS");
    await expectSmtp(reader, [220]);
    writer.releaseLock();
    reader.releaseLock();
    socket = socket.startTls({ expectedServerHostname: config.host });
    await socket.opened;
    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();
    await writeSmtp(writer, `EHLO ${publicUrl().replace(/^https?:\/\//, "")}`);
    await expectSmtp(reader, [250]);
  }

  await writeSmtp(writer, "AUTH LOGIN");
  await expectSmtp(reader, [334]);
  await writeSmtp(writer, btoa(config.user ?? ""));
  await expectSmtp(reader, [334]);
  await writeSmtp(writer, btoa(config.password ?? ""));
  await expectSmtp(reader, [235]);
  await writeSmtp(writer, `MAIL FROM:<${config.from}>`);
  await expectSmtp(reader, [250]);
  await writeSmtp(writer, `RCPT TO:<${message.to}>`);
  await expectSmtp(reader, [250, 251]);
  await writeSmtp(writer, "DATA");
  await expectSmtp(reader, [354]);
  await writeSmtp(writer, `${mailBody(message, config.from ?? "")}\r\n.`);
  await expectSmtp(reader, [250]);
  await writeSmtp(writer, "QUIT");
  writer.releaseLock();
  reader.releaseLock();
  await socket.close();
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
