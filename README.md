# Nexpertic AI Service Desk

MVP de mesa de ayuda con IA para operacion TI, tickets, control de acceso,
auditoria, integracion GLPI y flujo de asistencia remota con consentimiento.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

Ruta local del proyecto:

```text
/Users/fadasme/Documents/Codex/2026-07-20/ay
```

El desarrollo local parte en modo demo. Para preparar un piloto, usa
`.env.pilot.example` como contrato de variables y configura secretos reales
fuera del repositorio.

## Useful Commands

- `npm run dev`: inicia desarrollo local
- `npm run build`: valida el build de vinext
- `npm run smoke:local`: prueba endpoints clave contra `http://localhost:3000`
- `npm run e2e:local`: valida flujo ticket -> GLPI/fallback -> RustDesk -> auditoria -> readiness
- `npm run test:oidc`: valida seguridad OIDC localmente
- `npm run test:glpi`: valida adapter GLPI localmente
- `npm run test:env-template`: valida plantillas demo/piloto sin secretos reales
- `npm test`: build y pruebas automatizadas principales
- `npm run db:generate`: genera migraciones Drizzle si se modifica schema
- `npm run db:verify`: verifica manifiesto, SQL y schema Drizzle versionado
- `npm run db:plan:pilot`: muestra comandos D1 para schema + baseline limpio
- `npm run db:plan:demo`: muestra comandos D1 local para schema + demo

## VPS / Deploy

Cuando toque mover la instancia a un VPS, el runbook recomendado esta en
[`outputs/nexera-ai-service-desk/95-vps-preparacion.md`](/Users/fadasme/Documents/Codex/2026-07-20/ay/outputs/nexera-ai-service-desk/95-vps-preparacion.md).
Ese flujo asume `systemd`, `nginx`, Node `>=22.13.0` y app escuchando en
`127.0.0.1:3000`.

## Database Seeds

Seeds versionados:

- `lib/nexera/persistence/seeds/001-pilot-baseline.sql`: tenant piloto y usuario admin, sin tickets demo.
- `lib/nexera/persistence/seeds/002-demo-data.sql`: datos opcionales para demos comerciales/locales.

Para piloto cliente, usar primero la migracion `001-initial-schema.sql` y luego el seed `001-pilot-baseline.sql`. El seed demo debe quedar fuera de ambientes con datos reales.

Plan de aplicacion:

```bash
npm run db:plan:pilot
node scripts/db-apply.mjs --mode pilot --database <d1-name-or-id> --execute
```

Demo local opcional:

```bash
npm run db:plan:demo
node scripts/db-apply.mjs --mode demo --database <d1-name-or-id> --local --execute
```

## Environment

Los archivos `.env.example` y `.env.pilot.example` contienen solo placeholders
seguros. `.env.example` mantiene desarrollo local en demo; `.env.pilot.example`
deja el contrato listo para piloto/cliente con demo desactivado. No deben quedar
tokens reales, client secrets, user tokens de GLPI ni secretos de firma en el
repositorio.

Variables principales:

- `NEXERA_AUTH_MODE`: `demo` para desarrollo local, `production` para piloto.
- `NEXERA_SEED_DEMO`: `true` carga datos demo, `false` evita sembrarlos.
- `NEXERA_ALLOW_DEMO_CLEANUP`: habilita limpieza controlada solo cuando sea necesario.
- `NEXERA_E2E_VALIDATED`: marca evidencia formal E2E para readiness.
- `NEXERA_E2E_VALIDATED_AT`: timestamp de la corrida E2E formal.
- `NEXERA_SESSION_SECRET`: firma la cookie `nexera_session`.
- `NEXERA_CONSENT_SECRET`: firma tokens de consentimiento RustDesk.
- `NEXERA_OIDC_STATE_SECRET`: firma el estado OIDC.
- `OIDC_*`: configura login SSO/OIDC o Microsoft Entra ID.
- `OIDC_JWKS_CACHE_TTL_SECONDS`: TTL opcional para cache de llaves JWKS.
- `OIDC_GROUPS_*`: mapea grupos OIDC a roles `Admin`, `Analista`, `Ejecutivo` y `Usuario`.
- `GLPI_*`: configura la integracion operacional con GLPI.
- `GLPI_TIMEOUT_MS` y `GLPI_MAX_RETRIES`: controlan timeout y reintentos del adapter GLPI.
- `NEXERA_D1_DATABASE`: nombre o ID opcional de D1 para scripts operativos.

Para generar secretos locales seguros:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Pilot Checklist

Antes de cargar datos reales:

- Copiar `.env.pilot.example` a un archivo local ignorado o configurar esas
  variables en el proveedor de despliegue.
- Configurar `NEXERA_AUTH_MODE=production`.
- Configurar `NEXERA_SEED_DEMO=false`.
- Mantener `NEXERA_ALLOW_DEMO_CLEANUP=false` salvo ventana controlada de limpieza.
- Usar seed `001-pilot-baseline.sql`, no `002-demo-data.sql`.
- Definir secretos unicos por ambiente.
- Configurar `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` y `OIDC_REDIRECT_URI`.
- Configurar `GLPI_BASE_URL`, `GLPI_APP_TOKEN` y `GLPI_USER_TOKEN`.
- Ejecutar `npm run build`.
- Ejecutar `npm run db:verify`.
- Con la app local levantada en `http://localhost:3000`, ejecutar `npm run smoke:local`.
- Ejecutar `npm run e2e:local` y registrar `NEXERA_E2E_VALIDATED=true`.

## Producto Implementado

Flujos principales disponibles:

- Portal usuario con creacion de tickets y vista `Mis tickets`.
- Requester ligado a sesion para usuarios finales.
- Cola inteligente para Analista/Admin.
- Sanitizacion runtime de actualizaciones de ticket.
- Auditoria server-side de creacion, clasificacion y sugerencia RAG.
- Busqueda Knowledge/RAG por texto y dominio.
- Sugerencia RAG al crear tickets.
- GLPI adapter con fallback, retries y pull desde GLPI.
- RustDesk con consentimiento firmado, tenant-bound y bloqueo antes de aprobacion.
- RBAC server-side para usuarios, tickets, knowledge, diagnosticos e integraciones.
- Readiness de piloto con evidencia E2E.
- Postura de secretos sin exponer tokens.

## Pilot Pack

La documentacion operativa vive en:

```text
outputs/nexera-ai-service-desk
```

Puntos clave:

- `77-final-pilot-checklist.md`: checklist final para salida a piloto.
- `83-diagnostics-endpoint-hardening.md`: hardening de endpoints de diagnostico.
- `84-user-ticket-self-scope.md`: lectura self-service de tickets.
- `85-session-bound-ticket-requester.md`: requester ligado a sesion.
- `86-ticket-update-sanitization.md`: sanitizacion de actualizaciones.
- `89-knowledge-search-mvp.md`: busqueda Knowledge/RAG.
- `90-knowledge-search-ui.md`: UI Knowledge/RAG.
- `91-ticket-rag-suggestion.md`: sugerencia RAG al crear ticket.
- `92-backend-ticket-rag-audit.md`: auditoria backend de ticket y RAG.

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
