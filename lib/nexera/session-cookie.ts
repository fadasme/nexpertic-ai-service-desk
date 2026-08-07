import type { SessionUser } from "./contracts";
import { getDefaultSessionTtlMinutes } from "./runtime-config";

const textEncoder = new TextEncoder();
const SESSION_COOKIE = "nexera_session";
const SESSION_LOCK_COOKIE = "nexera_session_lock";
const DEFAULT_SESSION_TTL_MINUTES = getDefaultSessionTtlMinutes();

function sessionTtlMinutes() {
  const raw = Number(process.env.NEXERA_SESSION_TTL_MINUTES ?? DEFAULT_SESSION_TTL_MINUTES);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SESSION_TTL_MINUTES;
  return Math.min(Math.max(Math.floor(raw), 5), 24 * 60);
}

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

export function sessionLockCookieName() {
  return SESSION_LOCK_COOKIE;
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
  const expiresAt = Date.now() + sessionTtlMinutes() * 60 * 1000;
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
  return { ...session, expiresAt: new Date(decoded.exp).toISOString() };
}

type SessionLock = {
  email: string;
  id: string;
  lockedAt: string;
};

async function signLockPayload(value: SessionLock & { exp: number }) {
  const payload = base64UrlJson(value);
  return `${payload}.${await hmac(payload)}`;
}

export async function signSessionLockCookie(session: SessionUser) {
  const expiresAt = Date.now() + sessionTtlMinutes() * 60 * 1000;
  return signLockPayload({
    email: session.email,
    exp: expiresAt,
    id: session.id,
    lockedAt: new Date().toISOString(),
  });
}

export async function buildSessionLockCookie(session: SessionUser) {
  const value = await signSessionLockCookie(session);
  return `${SESSION_LOCK_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMinutes() * 60}`;
}

export async function verifySessionLockCookie(value?: string | null) {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (signature !== (await hmac(payload))) return null;

  const decoded = decodeBase64UrlJson<SessionLock & { exp: number }>(payload);
  if (Date.now() > decoded.exp) return null;

  const { exp: _exp, ...lock } = decoded;
  return lock;
}

export function buildSessionSetCookie(value: string) {
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMinutes() * 60}`;
}

export function getSessionTtlMinutes() {
  return sessionTtlMinutes();
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function clearSessionLockCookie() {
  return `${SESSION_LOCK_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
