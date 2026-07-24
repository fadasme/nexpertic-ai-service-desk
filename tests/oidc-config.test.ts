import assert from "node:assert/strict";
import test from "node:test";
import { isDevOidcStateSecret, mapClaimsToUserAccount, verifyIdTokenClaims } from "../lib/nexera/oidc-config.ts";
import type { UserAccount } from "../lib/nexera/contracts.ts";

const issuer = "https://login.example.test/tenant/v2.0";
const audience = "nexpertic-client-id";
const nonce = "nonce-for-test";
const kid = "test-key-1";

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return Buffer.from(bytes).toString("base64url");
}

async function generateSigningFixture() {
  const keyPair = await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicJwk: {
      ...publicJwk,
      alg: "RS256",
      kid,
      use: "sig",
    },
  };
}

async function signToken(privateKey: CryptoKey, payloadOverrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    kid,
    typ: "JWT",
  };
  const payload = {
    aud: audience,
    email: "ana@nexpertic.test",
    exp: now + 300,
    groups: ["Nexpertic-Analysts"],
    iss: issuer,
    name: "Ana Analista",
    nonce,
    oid: "external-user-1",
    tid: "tenant-1",
    ...payloadOverrides,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned));

  return `${unsigned}.${base64Url(signature)}`;
}

function configureEnv(jwksSuffix = "default") {
  process.env.OIDC_ISSUER = issuer;
  process.env.OIDC_CLIENT_ID = audience;
  process.env.OIDC_CLIENT_SECRET = "secret-for-test";
  process.env.OIDC_REDIRECT_URI = "https://app.example.test/api/auth/oidc/callback";
  process.env.OIDC_JWKS_URI = `https://login.example.test/jwks/${jwksSuffix}`;
  process.env.OIDC_JWKS_CACHE_TTL_SECONDS = "60";
  process.env.OIDC_GROUPS_ADMIN = "Nexpertic-Admins";
  process.env.OIDC_GROUPS_ANALYST = "Nexpertic-Analysts";
  process.env.OIDC_GROUPS_EXECUTIVE = "Nexpertic-Executives";
  process.env.OIDC_GROUPS_USER = "Nexpertic-Users";
}

test("verifies a signed OIDC ID token with JWKS", async () => {
  configureEnv("valid-token");
  const fixture = await generateSigningFixture();
  globalThis.fetch = async () =>
    Response.json({
      keys: [fixture.publicJwk],
    });

  const token = await signToken(fixture.privateKey);
  const claims = await verifyIdTokenClaims(token, nonce);

  assert.equal(claims.email, "ana@nexpertic.test");
  assert.equal(claims.externalId, "external-user-1");
  assert.equal(claims.name, "Ana Analista");
  assert.deepEqual(claims.groups, ["Nexpertic-Analysts"]);
});

test("rejects nonce, audience, expiration and signature failures", async () => {
  configureEnv("rejections");
  const fixture = await generateSigningFixture();
  globalThis.fetch = async () =>
    Response.json({
      keys: [fixture.publicJwk],
    });

  await assert.rejects(
    verifyIdTokenClaims(await signToken(fixture.privateKey), "wrong-nonce"),
    /nonce mismatch/,
  );
  await assert.rejects(
    verifyIdTokenClaims(await signToken(fixture.privateKey, { aud: "wrong-client" }), nonce),
    /audience mismatch/,
  );
  await assert.rejects(
    verifyIdTokenClaims(await signToken(fixture.privateKey, { exp: Math.floor(Date.now() / 1000) - 10 }), nonce),
    /expired/,
  );

  const otherFixture = await generateSigningFixture();
  await assert.rejects(
    verifyIdTokenClaims(await signToken(otherFixture.privateKey), nonce),
    /signature verification failed/,
  );
});

test("maps OIDC groups to Nexpertic roles and preserves existing internal roles", () => {
  configureEnv();
  const existingUsers: UserAccount[] = [
    {
      email: "ana@nexpertic.test",
      id: "user-ana",
      name: "Ana Analista",
      permissions: ["ticket:read"],
      role: "Ejecutivo",
      status: "Activo",
      tenant: "Nexpertic",
      tenantId: "tenant-nexera-pilot",
    },
  ];

  assert.deepEqual(
    mapClaimsToUserAccount(
      {
        email: "ana@nexpertic.test",
        externalId: "external-user-1",
        groups: ["Nexpertic-Admins"],
        name: "Ana Analista",
      },
      existingUsers,
    ),
    {
      matched: true,
      role: "Ejecutivo",
      userId: "user-ana",
    },
  );

  assert.equal(
    mapClaimsToUserAccount(
      {
        email: "new-analyst@nexpertic.test",
        externalId: "external-user-2",
        groups: ["Nexpertic-Analysts"],
        name: "Nuevo Analista",
      },
      existingUsers,
    ).role,
    "Analista",
  );

  assert.equal(
    mapClaimsToUserAccount(
      {
        email: "no-group@nexpertic.test",
        externalId: "external-user-3",
        groups: ["Unknown"],
        name: "Sin Grupo",
      },
      existingUsers,
    ).role,
    "Usuario",
  );
});

test("detects missing OIDC state signing secret", () => {
  const previous = process.env.NEXERA_OIDC_STATE_SECRET;

  try {
    delete process.env.NEXERA_OIDC_STATE_SECRET;
    assert.equal(isDevOidcStateSecret(), true);

    process.env.NEXERA_OIDC_STATE_SECRET = "long-state-secret-for-test";
    assert.equal(isDevOidcStateSecret(), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXERA_OIDC_STATE_SECRET;
    } else {
      process.env.NEXERA_OIDC_STATE_SECRET = previous;
    }
  }
});
