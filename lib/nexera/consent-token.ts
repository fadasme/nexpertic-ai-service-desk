const textEncoder = new TextEncoder();

function base64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(message: string) {
  const secret = process.env.NEXERA_CONSENT_SECRET ?? "nexera-dev-consent-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );

  return base64Url(await crypto.subtle.sign("HMAC", key, textEncoder.encode(message)));
}

export async function signConsentToken(rawToken: string, expiresAt: string, tenantId = "tenant-nexera-pilot") {
  const expiresAtMs = String(new Date(expiresAt).getTime());
  const payload = `v2.${rawToken}.${tenantId}.${expiresAtMs}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyConsentToken(signedToken: string) {
  const parts = signedToken.split(".");

  if (parts[0] === "v2") {
    const [_version, rawToken, tenantId, expiresAtMs, signature] = parts;
    if (!rawToken || !tenantId || !expiresAtMs || !signature) return null;

    const expected = await hmac(`v2.${rawToken}.${tenantId}.${expiresAtMs}`);
    if (signature !== expected) return null;

    return {
      expiresAt: new Date(Number(expiresAtMs)).toISOString(),
      rawToken,
      tenantId,
      version: "v2" as const,
    };
  }

  const [rawToken, expiresAtMs, signature] = parts;
  if (!rawToken || !expiresAtMs || !signature) return null;

  const expected = await hmac(`${rawToken}.${expiresAtMs}`);
  if (signature !== expected) return null;

  return {
    expiresAt: new Date(Number(expiresAtMs)).toISOString(),
    rawToken,
    tenantId: undefined,
    version: "legacy" as const,
  };
}

export function isDevConsentSecret() {
  return !process.env.NEXERA_CONSENT_SECRET;
}
