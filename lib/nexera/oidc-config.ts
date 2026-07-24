import type { ExternalIdentityClaims, IdentityProviderConfig, OidcJwksStatus, UserAccount, UserRole } from "./contracts";

const textEncoder = new TextEncoder();

function configured(value?: string) {
  return Boolean(value && value.trim());
}

export function isDevOidcStateSecret() {
  return !process.env.NEXERA_OIDC_STATE_SECRET;
}

function providerName(): IdentityProviderConfig["provider"] {
  return process.env.OIDC_PROVIDER === "oidc" ? "OIDC" : "Microsoft Entra ID";
}

function oidcScopes() {
  return (process.env.OIDC_SCOPES ?? "openid profile email")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function base64UrlToJson<T>(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as T;
}

export function getOidcConfig(): IdentityProviderConfig {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const jwksUri = process.env.OIDC_JWKS_URI;
  const isConfigured = configured(issuer) && configured(clientId) && configured(clientSecret) && configured(redirectUri);

  return {
    authorizationUrl: issuer ? `${issuer.replace(/\/$/, "")}/oauth2/v2.0/authorize` : undefined,
    clientIdConfigured: configured(clientId),
    clientSecretConfigured: configured(clientSecret),
    issuer,
    jwksUri,
    mode: isConfigured ? "configured" : "not_configured",
    provider: providerName(),
    redirectUri,
    scopes: oidcScopes(),
  };
}

export function oidcDiscoveryUrl() {
  return process.env.OIDC_ISSUER ? `${process.env.OIDC_ISSUER.replace(/\/$/, "")}/.well-known/openid-configuration` : undefined;
}

export function oidcTokenUrl() {
  return process.env.OIDC_ISSUER ? `${process.env.OIDC_ISSUER.replace(/\/$/, "")}/oauth2/v2.0/token` : undefined;
}

type OidcDiscovery = {
  authorization_endpoint?: string;
  issuer?: string;
  jwks_uri?: string;
  token_endpoint?: string;
};

type JwksResponse = {
  keys?: JsonWebKey[];
};

type JwksCacheEntry = {
  expiresAt: number;
  jwks: JwksResponse;
  uri: string;
};

type IdTokenHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

const DEFAULT_JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
let jwksCache: JwksCacheEntry | null = null;

function jwksCacheTtlMs() {
  const configuredTtlSeconds = Number(process.env.OIDC_JWKS_CACHE_TTL_SECONDS);
  if (Number.isFinite(configuredTtlSeconds) && configuredTtlSeconds > 0) {
    return configuredTtlSeconds * 1000;
  }

  return DEFAULT_JWKS_CACHE_TTL_MS;
}

export async function getOidcJwksStatus(): Promise<OidcJwksStatus> {
  const discoveryUrl = oidcDiscoveryUrl();
  const staticJwksUri = process.env.OIDC_JWKS_URI;

  if (!discoveryUrl && !staticJwksUri) {
    return {
      discoveryAvailable: false,
      error: "OIDC_ISSUER or OIDC_JWKS_URI is required",
      issuerConfigured: false,
      jwksAvailable: false,
      jwksKeyCount: 0,
      jwksUriConfigured: false,
    };
  }

  try {
    const discoveryAvailable = Boolean(!staticJwksUri && discoveryUrl);
    const jwksUri = await resolveJwksUri();
    const jwks = await fetchJwks();

    return {
      discoveryAvailable,
      issuerConfigured: Boolean(process.env.OIDC_ISSUER),
      jwksAvailable: Boolean(jwks.keys?.length),
      jwksKeyCount: jwks.keys?.length ?? 0,
      jwksUriConfigured: Boolean(jwksUri),
    };
  } catch (error) {
    return {
      discoveryAvailable: false,
      error: error instanceof Error ? error.message : "OIDC JWKS validation failed",
      issuerConfigured: Boolean(process.env.OIDC_ISSUER),
      jwksAvailable: false,
      jwksKeyCount: 0,
      jwksUriConfigured: Boolean(staticJwksUri),
    };
  }
}

function base64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(message: string) {
  const secret = process.env.NEXERA_OIDC_STATE_SECRET ?? process.env.NEXERA_CONSENT_SECRET ?? "nexera-dev-oidc-state-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );

  return base64Url(await crypto.subtle.sign("HMAC", key, textEncoder.encode(message)));
}

export function randomOidcValue() {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function signOidcState(nonce: string, returnTo = "/") {
  const expiresAt = String(Date.now() + 10 * 60 * 1000);
  const payload = `${nonce}.${expiresAt}.${encodeURIComponent(returnTo)}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyOidcState(state?: string | null) {
  if (!state) return null;

  const [nonce, expiresAt, encodedReturnTo, signature] = state.split(".");
  if (!nonce || !expiresAt || !encodedReturnTo || !signature) return null;

  const payload = `${nonce}.${expiresAt}.${encodedReturnTo}`;
  if (signature !== (await hmac(payload))) return null;
  if (Date.now() > Number(expiresAt)) return null;

  return {
    nonce,
    returnTo: decodeURIComponent(encodedReturnTo),
  };
}

const oidcRoleEnv: Array<{ env: string; role: UserRole }> = [
  { env: "OIDC_GROUPS_ADMIN", role: "Admin" },
  { env: "OIDC_GROUPS_ANALYST", role: "Analista" },
  { env: "OIDC_GROUPS_EXECUTIVE", role: "Ejecutivo" },
  { env: "OIDC_GROUPS_USER", role: "Usuario" },
];

function oidcGroupsFromEnv(key: string) {
  return (process.env[key] ?? "")
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}

function fallbackRoleFromGroups(groups: string[] = []): UserRole {
  for (const mapping of oidcRoleEnv) {
    const configuredGroups = oidcGroupsFromEnv(mapping.env);
    if (configuredGroups.some((group) => groups.includes(group))) return mapping.role;
  }

  return "Usuario";
}

export function mapClaimsToUserAccount(claims: ExternalIdentityClaims, existingUsers: UserAccount[]) {
  const existing = existingUsers.find((user) => user.email.toLowerCase() === claims.email.toLowerCase());
  const fallbackRole = fallbackRoleFromGroups(claims.groups);

  return {
    matched: Boolean(existing),
    role: existing?.role ?? fallbackRole,
    userId: existing?.id,
  };
}

type OidcTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  id_token?: string;
  token_type?: string;
};

type IdTokenPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  groups?: string[];
  iat?: number;
  iss?: string;
  name?: string;
  nbf?: number;
  nonce?: string;
  oid?: string;
  preferred_username?: string;
  sub?: string;
  tid?: string;
};

async function resolveJwksUri() {
  if (process.env.OIDC_JWKS_URI) return process.env.OIDC_JWKS_URI;

  const discoveryUrl = oidcDiscoveryUrl();
  if (!discoveryUrl) throw new Error("OIDC issuer or JWKS URI is required");

  const discoveryResponse = await fetch(discoveryUrl);
  if (!discoveryResponse.ok) {
    throw new Error(`OIDC discovery failed with HTTP ${discoveryResponse.status}`);
  }

  const discovery = (await discoveryResponse.json()) as OidcDiscovery;
  if (!discovery.jwks_uri) throw new Error("OIDC discovery did not return jwks_uri");
  return discovery.jwks_uri;
}

async function fetchJwks(options: { forceRefresh?: boolean } = {}) {
  const jwksUri = await resolveJwksUri();
  const now = Date.now();

  if (!options.forceRefresh && jwksCache?.uri === jwksUri && jwksCache.expiresAt > now) {
    return jwksCache.jwks;
  }

  const response = await fetch(jwksUri);
  if (!response.ok) throw new Error(`OIDC JWKS failed with HTTP ${response.status}`);

  const jwks = (await response.json()) as JwksResponse;
  if (!jwks.keys?.length) throw new Error("OIDC JWKS did not contain signing keys");

  jwksCache = {
    expiresAt: now + jwksCacheTtlMs(),
    jwks,
    uri: jwksUri,
  };

  return jwks;
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function validateRequiredClaims(claims: IdTokenPayload, expectedNonce: string): ExternalIdentityClaims {
  const now = Math.floor(Date.now() / 1000);
  const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, "");
  const clientId = process.env.OIDC_CLIENT_ID;

  if (!issuer || !clientId) throw new Error("OIDC issuer and client id are required");
  if (claims.iss?.replace(/\/$/, "") !== issuer) throw new Error("OIDC issuer mismatch");
  if (Array.isArray(claims.aud) ? !claims.aud.includes(clientId) : claims.aud !== clientId) {
    throw new Error("OIDC audience mismatch");
  }
  if (!claims.exp || claims.exp <= now) throw new Error("OIDC ID token expired");
  if (claims.nbf && claims.nbf > now + 60) throw new Error("OIDC ID token is not active yet");
  if (claims.nonce !== expectedNonce) throw new Error("OIDC nonce mismatch");

  const email = claims.email ?? claims.preferred_username;
  const externalId = claims.oid ?? claims.sub;
  if (!email || !externalId || !claims.name) {
    throw new Error("OIDC claims missing required identity fields");
  }

  return {
    email,
    externalId,
    groups: claims.groups,
    name: claims.name,
    tenant: claims.tid,
  };
}

export async function exchangeAuthorizationCode(code: string) {
  const tokenUrl = oidcTokenUrl();

  if (!tokenUrl || !process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET || !process.env.OIDC_REDIRECT_URI) {
    throw new Error("OIDC token exchange is not configured");
  }

  const body = new URLSearchParams({
    client_id: process.env.OIDC_CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.OIDC_REDIRECT_URI,
  });

  const response = await fetch(tokenUrl, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = (await response.json()) as OidcTokenResponse;

  if (!response.ok || payload.error || !payload.id_token) {
    throw new Error(payload.error_description ?? payload.error ?? "OIDC token exchange failed");
  }

  return payload;
}

export function parseUnverifiedIdTokenClaims(idToken: string, expectedNonce: string): ExternalIdentityClaims {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("Invalid ID token format");

  const claims = base64UrlToJson<IdTokenPayload>(payload);
  return validateRequiredClaims(claims, expectedNonce);
}

export async function verifyIdTokenClaims(idToken: string, expectedNonce: string): Promise<ExternalIdentityClaims> {
  const [rawHeader, rawPayload, rawSignature] = idToken.split(".");
  if (!rawHeader || !rawPayload || !rawSignature) throw new Error("Invalid ID token format");

  const header = base64UrlToJson<IdTokenHeader>(rawHeader);
  if (header.alg !== "RS256") throw new Error("Unsupported OIDC ID token algorithm");
  if (!header.kid) throw new Error("OIDC ID token missing key id");

  const jwks = await fetchJwks();
  let jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) {
    const refreshedJwks = await fetchJwks({ forceRefresh: true });
    jwk = refreshedJwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
  }
  if (!jwk) throw new Error("OIDC signing key not found in JWKS");

  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, alg: "RS256", ext: true },
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );

  const signedContent = textEncoder.encode(`${rawHeader}.${rawPayload}`);
  const signature = base64UrlToBytes(rawSignature);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedContent);
  if (!verified) throw new Error("OIDC ID token signature verification failed");

  const claims = base64UrlToJson<IdTokenPayload>(rawPayload);
  return validateRequiredClaims(claims, expectedNonce);
}
