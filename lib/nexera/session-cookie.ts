import type { SessionUser } from "./contracts";

const textEncoder = new TextEncoder();
const SESSION_COOKIE = "nexera_session";

function base64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlJson(value: unknown) {
  return base64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeBase64UrlJson<T>(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as T;
}

async function hmac(message: string) {
  const secret = process.env.NEXERA_SESSION_SECRET ?? process.env.NEXERA_CONSENT_SECRET ?? "nexera-dev-session-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );

  return base64Url(await crypto.subtle.sign("HMAC", key, textEncoder.encode(message)));
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function isDevSessionSecret() {
  return !process.env.NEXERA_SESSION_SECRET;
}

export async function signSessionCookie(session: SessionUser) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = base64UrlJson({ ...session, exp: expiresAt });
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionCookie(value?: string | null) {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (signature !== (await hmac(payload))) return null;

  const decoded = decodeBase64UrlJson<SessionUser & { exp: number }>(payload);
  if (Date.now() > decoded.exp) return null;

  const { exp: _exp, ...session } = decoded;
  return session;
}

export function buildSessionSetCookie(value: string) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
