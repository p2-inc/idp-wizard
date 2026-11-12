# wizard-v2 — Agent Context

This file is the authoritative context document for AI agents working on wizard-v2. Read it before making changes. It covers architecture decisions, key patterns, and known gaps. For setup and testing commands, see [README.md](README.md).

---

## What this project is

wizard-v2 is the default frontend of the Phase Two IdP (Identity Provider) Wizard — a Keycloak extension that guides administrators through connecting an external identity provider (Okta, Entra ID, Google, etc.) to a Keycloak realm.

**The core goal:** replace per-provider React component trees (wizard-v1) with a declarative JSON-driven model. Each wizard is a JSON file. A generic runtime engine reads the JSON and renders the wizard. Adding a new provider = writing a new JSON file, not writing new components.

**Deployment context:** wizard-v2 is a Vite SPA bundled into a Keycloak JAR via Maven's `frontend-maven-plugin`. When deployed, it runs inside Keycloak at a URL like `https://keycloak.example.com/realms/{realm}/wizard/`. The root `pom.xml` builds both wizard-v1 and wizard-v2 into the same JAR (`theme/wizard/login/resources/v1` and `.../v2`), and the extension picks one per request: the `_providerConfig.wizard.version` realm attribute, then the server-wide SPI default, then the built-in default `v2`. See [Choosing between wizard-v1 and wizard-v2](README.md#choosing-between-wizard-v1-and-wizard-v2).

---

## Monorepo structure

```
idp-wizard/                        ← Maven project root
├── pom.xml                        ← Maven build; packages both apps into one JAR
├── pnpm-workspace.yaml            ← pnpm workspace: apps/*
├── apps/
│   ├── wizard-v1/                 ← PatternFly + webpack + Redux (legacy, opt-in via realm attribute)
│   └── wizard-v2/                 ← Vite + shadcn + Tailwind (default)
└── README.md
```

All work described in this file is inside `apps/wizard-v2/`.

---

## Stack

| Layer     | Choice                              | Why                                                        |
| --------- | ----------------------------------- | ---------------------------------------------------------- |
| Build     | Vite 8                              | Fast, modern, ESM-native                                   |
| UI        | React 19 + shadcn/ui (new-york)     | Component library matching the Phase Two dashboard         |
| Styling   | Tailwind CSS v4                     | CSS-first, no separate config file; OKLCH color tokens     |
| Routing   | TanStack Router (file-based)        | Full type-safe routing with `validateSearch`, `beforeLoad` |
| Auth      | oidc-spa v10                        | OIDC against Keycloak; `withAutoLogin()`, no token schema  |
| API types | openapi-typescript + openapi-fetch  | Typed clients from OpenAPI specs, no Redux needed          |
| State     | useReducer (local to wizard runner) | Lightweight; no Redux, no global store                     |
| Testing   | Playwright                          | E2E, Page Object Model                                     |

---

## File structure

```
apps/wizard-v2/
├── docker/
│   ├── docker-compose.yml            # Dev Keycloak (Phase Two image, pre-configured, :8080/auth)
│   └── realm-export.json             # Auto-imported: realm "wizard", client "wizard-v2-dev", test users
├── e2e/
│   ├── external-providers/           # Opt-in full-loop tests against real Auth0 / Okta tenants
│   ├── fixtures/test.ts              # Extended Playwright fixture with typed page objects
│   ├── pages/                        # Page objects: KeycloakLoginPage, ProviderSelectorPage, WizardPage
│   ├── auth.setup.ts                 # Integration mode: real OIDC login, saves storage state
│   ├── global-setup.ts               # Integration mode: creates test orgs, assigns users
│   ├── organizations.spec.ts         # Integration mode: org context and org-scoped API calls
│   ├── provider-selector.spec.ts     # Smoke tests (navigation, search, help dialog)
│   └── wizard-completion.spec.ts     # Full SAML/OIDC/LDAP flows (API mocked) + wizard load smoke tests
├── openapi-codegen/
│   └── gen.ts                        # Fetches both OpenAPI specs and generates src/api/types/
├── public/
│   ├── favicons/                     # Browser favicon assets
│   ├── phasetwo-logos/               # Phase Two brand SVGs ({light,dark}/logo_phase_slash.svg is default)
│   ├── provider-logos/               # Per-provider logos for the selector UI
│   └── wizards/                      # Step screenshots: /wizards/{provider}/saml/step1.png etc.
├── scripts/
│   └── optimize-screenshots.sh       # `pnpm optimize:screenshots` (see Screenshots)
├── src/
│   ├── api/
│   │   ├── clients.ts                # createOrgsClient() + createAdminClient() — typed, auth-injecting
│   │   └── types/
│   │       ├── orgs.d.ts             # Generated: Phase Two Orgs API (org-scoped IDPs)
│   │       └── admin.d.ts            # Generated: Keycloak Admin API (realm-wide IDPs)
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (button, dialog, input, …)
│   │   └── wizard/                   # WizardRunner, WizardStep, executeAction, resolveTemplate, types
│   ├── context/
│   │   └── WizardContext.tsx         # WizardContextValue, WizardState, WizardAction, wizardReducer
│   ├── data/
│   │   └── providers.ts              # Provider registry: id, name, logo, protocols[]
│   ├── hooks/
│   │   ├── useWizardConfig.ts        # Fetches {target realm}/wizard/config.json (logoUrl, appName, apiMode…)
│   │   ├── useWizardApi.ts           # Derives API context from runtime config + orgId + config
│   │   ├── useAppLogo.ts             # Logo cascade (theme override → logoUrl → Phase Two fallback)
│   │   └── useUnsavedChangesGuard.ts # Leave-wizard confirmation prompt
│   ├── lib/
│   │   ├── alias.ts                  # getOrCreateAlias() + clearAlias() — sessionStorage
│   │   ├── http-error.ts             # Maps HTTP status to specific action error messages
│   │   ├── idp-test-link.ts          # Post-creation IdP test link via the idp-tester client
│   │   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   ├── routes/
│   │   ├── __root.tsx                                    # Root: OidcInitializationGate + devtools
│   │   ├── _authenticated.tsx                            # Layout: home button (hidden on index)
│   │   ├── _authenticated.index.tsx                      # Provider selector (/)
│   │   ├── _authenticated.wizard.$providerId.tsx         # Layout wrapper: validates provider, Outlet only
│   │   ├── _authenticated.wizard.$providerId.index.tsx   # Protocol picker
│   │   └── _authenticated.wizard.$providerId.$protocol.tsx  # Wizard runner ← main work area
│   ├── bootstrap.ts                  # oidc-spa early init, then loads main.tsx
│   ├── index.css                     # Tailwind v4 + Phase Two OKLCH color tokens
│   ├── main.tsx                      # RouterProvider entry point
│   ├── oidc.ts                       # oidc-spa: useOidc, fetchWithAuth, OidcInitializationGate
│   └── runtime-config.ts             # Server URL, auth vs. target realm, client ID, assetUrl()
├── wizards/
│   ├── saml/saml.json                # Generic SAML wizard (id="generic-saml") ← canonical schema reference
│   ├── openid/oidc.json              # Generic OpenID Connect wizard
│   ├── ldap/ldap.json                # Generic LDAP user federation wizard
│   ├── scim/scim.json                # Generic SCIM wizard
│   ├── MIGRATION.md                  # v1 → v2 provider inventory, mapper conventions, patterns
│   └── {providerId}/
│       └── {protocol}.json           # e.g. okta/saml.json, entraid/oidc.json, github/oauth.json
├── .env.local.sample                 # Environment variable template
├── components.json                   # shadcn/ui config
├── playwright.config.ts              # Playwright E2E config (mock or integration mode, auto-starts Vite)
└── AGENTS.md                         # ← this file
```

---

## Environment

```
VITE_OIDC_USE_MOCK=false             # "true" skips Keycloak entirely (UI-only dev, mock-mode e2e)
VITE_OIDC_ISSUER_URI=http://localhost:8080/auth/realms/wizard
VITE_OIDC_CLIENT_ID=wizard-v2-dev
VITE_OIDC_SPA_DEBUG=false
VITE_WIZARD_DISABLE_LEAVE_GUARD=false
```

These `VITE_OIDC_*` values are a `vite dev` fallback only. In production, `src/runtime-config.ts` reads the server URL, auth realm, and client ID from the `keycloak.json` the extension serves, and the target realm from the page URL. `parseIssuerUri()` in the same file handles both `/auth/realms/` and `/realms/` Keycloak paths.

- Dev Keycloak: `cd docker && docker compose up` (or `pnpm docker:up`), served at `http://localhost:8080/auth`; admin console `admin` / `admin` (local-only).
- Test user (local Docker realm only): `wizard` / `password` with the `realm-admin` role. `org-admin` and `org-member` (same password) exist for org tests.

---

## Routing

TanStack Router file-based routing. The flat file naming convention uses dots for path segments:

| File                                              | Route                                      |
| ------------------------------------------------- | ------------------------------------------ |
| `_authenticated.tsx`                              | Layout wrapper (no path segment, pathless) |
| `_authenticated.index.tsx`                        | `/`                                        |
| `_authenticated.wizard.$providerId.tsx`           | Layout for `/wizard/:providerId/*`         |
| `_authenticated.wizard.$providerId.index.tsx`     | `/wizard/:providerId` (protocol picker)    |
| `_authenticated.wizard.$providerId.$protocol.tsx` | `/wizard/:providerId/:protocol`            |

**Critical gotcha — parent `beforeLoad` runs for child routes.** `$protocol` is a child of `$providerId` in the route tree. So the `$providerId` route's `beforeLoad` runs when navigating to `/wizard/adfs/saml`. Do not add redirects in `$providerId`'s `beforeLoad` that could target child routes — this causes infinite redirect loops. The `$providerId` route's `beforeLoad` only validates that the provider exists.

**Search params** (`?org_id=...`) are declared via `validateSearch: z.object({ org_id: z.string().optional() })` on each route that needs them (index, `$providerId`, `$protocol`). The `org_id` is passed forward through navigation calls so it persists across the full wizard flow.

---

## Organization context

When the wizard is launched from a Phase Two organization (e.g., from the dashboard), `?org_id=abc123` is appended to the URL.

- **`org_id` present → `apiMode: "cloud"`** → uses Phase Two Orgs API at `/{realm}/orgs/{orgId}/idps/...`
- **`org_id` absent → `apiMode: "onprem"`** → uses Keycloak Admin API at `/admin/realms/{realm}/identity-provider/...`

The `apiMode` can also be set via the realm config (`config.apiMode` from `useWizardConfig`), but `org_id` in the URL always takes precedence.

Both endpoint sets are fully typed via the generated OpenAPI clients.

### Who can configure what (`src/lib/org-access.ts`, `useOrgAccess`, `useRealmIdpAccess`)

- **An organization** is selectable in the org picker when the ID token's `organizations` claim gives the user the org roles in `REQUIRED_ORG_ROLES`: `view-identity-providers` and `manage-identity-providers`. Those are the only roles the Orgs API checks for its IdP endpoints; `view-organization` / `manage-organization` are not required. Orgs missing a role are still listed, disabled, with the missing roles named.
- **Global (realm-wide)** uses the Admin API and needs the same two roles on `realm-management` (or `{targetRealm}-realm` for master-realm users), read from `resource_access` in the access token and the ID token (roles are merged).
- When those realm roles are known to be missing, Global is shown disabled with the reason. A single eligible org is selected by default (`?org_id=` is set); with several, picking a provider before an org opens the picker; with none, a notice names the roles needed. The wizard route shows a "Pick an organization" gate instead of falling back to the Admin API, including on direct links.
- Realm access is `"unknown"` when neither token can tell (an undecodable access token and no `resource_access` in the ID token). Nothing is restricted then.
- In mock-OIDC mode, e2e tests set ID-token claims (including `resource_access`) through `window.__WIZARD_MOCK_ID_TOKEN__` (see `e2e/org-access.spec.ts`, `e2e/org-picker.spec.ts`). The mock access token is opaque, so the ID token decides.

---

## API clients

Two typed clients are available on `WizardContext`:

```ts
const { orgsClient, adminClient, activeClient, realm, orgId } =
  useWizardContext();

// Cloud (org-scoped) — Phase Two Orgs API
const { data, error } = await orgsClient.POST("/{realm}/orgs/{orgId}/idps", {
  params: { path: { realm, orgId: orgId! } },
  body: { alias, providerId: "saml", hideOnLogin: true, config: metadata },
});

// Onprem (realm-wide) — Keycloak Admin API
const { data, error } = await adminClient.POST(
  "/admin/realms/{realm}/identity-provider/instances",
  {
    params: { path: { realm } },
    body: { alias, providerId: "saml", hideOnLogin: true, config: metadata },
  },
);
```

Types are generated from the OpenAPI specs. Regenerate with `pnpm gen-api` when upstream specs change. The generated files (`src/api/types/orgs.d.ts`, `admin.d.ts`) are committed.

Key endpoints:

| Action            | Cloud path                                        | Onprem path                                                              |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Validate metadata | `POST /{realm}/orgs/{orgId}/idps/import-config`   | `POST /admin/realms/{realm}/identity-provider/import-config`             |
| Create IDP        | `POST /{realm}/orgs/{orgId}/idps`                 | `POST /admin/realms/{realm}/identity-provider/instances`                 |
| Add mapper        | `POST /{realm}/orgs/{orgId}/idps/{alias}/mappers` | `POST /admin/realms/{realm}/identity-provider/instances/{alias}/mappers` |

---

## Wizard JSON schema (`wizards/saml/saml.json`)

This is the canonical reference. All wizard JSON files follow this schema.

### Top-level shape

```jsonc
{
  "schemaVersion": "1.0",
  "id": "generic-saml",
  "providerId": "saml",        // matches Provider.id in providers.ts
  "protocol": "saml",          // "saml" | "oidc" | "ldap"
  "title": "Generic SAML",

  "alias": {
    "prefix": "generic-saml",    // prefix for generated alias: "{prefix}-{6chars}"
    "sessionKey": "p2_saml_saml" // sessionStorage key — unique per provider+protocol
  },

  "idpConfig": {                 // merged into the IDP creation request
    "providerId": "saml",
    "hideOnLogin": true,         // overridden at runtime by scope — see below
    "defaults": { ... }          // merged into metadata before sending to Keycloak
  },

  "steps": [ ... ],
  "forms": { ... },
  "actions": { ... }
}
```

### Steps

Each step has:

- `id` (number) — 1-indexed, sequential
- `title` (string)
- `type` (optional) — omit for normal steps; `"confirm"` for the final step
- `enableNextWhen` (optional) — expression string: e.g. `"state.metadataValidated"`
- `blocks` — array of UI blocks

Block types:

- `text` — `{ type: "text", content: "..." }`. Supports `**bold**` and auto-links `http(s)://` URLs (the `confirm` block's `description` does too). Follow the [Microsoft style guide](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/formatting-text-in-instructions) for instructions: bold UI element names instead of quoting them (`Select **Save**`, not `Click the "Save" button`), leave out the element type ("button", "link") unless it's needed for clarity (e.g. an icon-only **+** button), use "select" rather than "click", and write menu paths as `**Settings** > **Authentication**`. Keep labels exactly as the vendor UI shows them.
- `copy` — copyable value: `{ type: "copy", label: "ACS URL", value: "{{api.ssoUrl}}", hint: "..." }`
- `formGroup` — renders a tabbed/exclusive set of forms: `{ type: "formGroup", id: "metadataInput", exclusive: true, forms: ["metadataUrl", "metadataFile", "metadataManual"] }`
- `attributeTable` — two-column mapping display
- `secretReveal` — shows a server-generated secret (e.g. a SCIM bearer token) that the user must copy before leaving the step
- `image` — step screenshot: `{ type: "image", src: "/wizards/{provider}/{protocol}/step1.png", alt: "...", caption: "...", fullWidth: true }`
- `confirm` — final step confirmation button + result display. When the confirm action's body sends `"displayName": "{{displayName}}"`, an editable "Display name" field is shown above the button. Always use `{{displayName}}` (not `{{alias}}`) for `createIdp` display names so admins and users see a readable name.

### Screenshots

`src` is written root-relative (`/wizards/...`), but the wizard is not served from the server root in production — it is mounted at `/realms/{realm}/wizard/{version}/`. Paths are resolved through `assetUrl()` (`src/runtime-config.ts`) against the `wizard-asset-base` meta tag the theme template supplies. Use root-relative paths in the JSON and never hardcode a prefix; anything bypassing `assetUrl()` will work under `vite dev` and 404 in production.

**Optimize every screenshot you add.** These files ship inside the Keycloak extension JAR, which lands in every Keycloak image, so an unoptimized capture is paid for on every image pull rather than just by the browser. Straight from a Retina screen they run 2–3 MB each; optimized they are 40–300 KB with no visible difference at display size.

```sh
pnpm optimize:screenshots            # whole public/wizards tree, safe to re-run
pnpm optimize:screenshots path/to/dir
```

It downscales so neither side exceeds 1400px, then runs `pngquant` and `oxipng`. Requires `brew install imagemagick pngquant oxipng`. Override with `MAX_DIM` / `QUALITY` if a particular screenshot needs more detail.

Keep screenshots as PNG. Do not commit multi-megabyte captures — the whole tree was 92 MB before it was first optimized down to 14 MB, and it regressed once already when a batch of AVIFs was replaced with full-resolution PNGs.

### Template variables available in blocks and actions

| Variable                | Resolves to                                           |
| ----------------------- | ----------------------------------------------------- |
| `{{api.entityId}}`      | `{serverUrl}/realms/{realm}`                          |
| `{{api.ssoUrl}}`        | `{serverUrl}/realms/{realm}/broker/{alias}/endpoint`  |
| `{{api.samlMetadata}}`  | `{serverUrl}/realms/{realm}/protocol/saml/descriptor` |
| `{{api.adminLinkSaml}}` | Keycloak admin console link for the SAML IDP          |
| `{{api.adminLinkOidc}}` | Keycloak admin console link for the OIDC IDP          |
| `{{alias}}`             | The generated alias for this wizard session           |
| `{{displayName}}`       | IdP display name — defaults to the wizard `title`, editable on the confirm step; falls back to `{{alias}}` when blank |
| `{{state.metadata}}`    | The validated IDP config object from `import-config`  |
| `{{form.fieldId}}`      | A field value from the currently active form          |
| `{{item.*}}`            | Current item in a `foreach` action iteration          |

### Forms

Each form in the `forms` dictionary has:

- `title`, `description`
- `fields` — array of `{ id, type, label, required, placeholder?, accept?, ... }`
  - Field types: `text`, `url`, `file`, `password`, `textarea`
- `submit` — `{ label: "Validate URL", action: "actionKey" }`

### Actions

Each action in the `actions` dictionary:

```jsonc
{
  "endpoint": "importConfig",   // named slot; runner resolves to actual URL from context
  "method": "POST",
  "contentType": "json",        // "json" or "multipart"
  "body": { ... },              // template vars resolved at call time
  "foreach": [ ... ],           // optional: iterate body over each item (used for mappers)
  "onSuccess": {
    "mergeIntoMetadata": "{{response}}",    // merge response into state.metadata
    "dispatch": ["METADATA_VALIDATED"],     // fire reducer actions
    "then": ["addSamlMappers", "clearAlias"] // chain follow-up actions
  },
  "messages": {
    "success": "...",
    "error": "..."
  }
}
```

Named endpoint slots (`endpoint` key):

- `importConfig` — validates metadata; returns raw IDP config object
- `createIdp` — creates the identity provider
- `addMappers` — adds attribute mapper to an existing IDP

`hideOnLogin` on the `createIdp` body is set by the executor from the IdP's scope,
regardless of what the JSON declares: `true` for org-scoped IdPs (reached via home-IdP
discovery) and `false` for realm-wide IdPs (no discovery domain, so they must be visible
on the login page). See `applyHideOnLogin` in `src/components/wizard/executeAction.ts`.

Special action types (no `endpoint`):

- `{ "type": "clearAlias" }` — removes alias from sessionStorage

---

## Wizard state (useReducer)

State lives in `WizardContext` and is managed by `wizardReducer` in `src/context/WizardContext.tsx`.

```ts
interface WizardState {
  alias: string; // stable for the session
  displayName: string; // IdP display name, seeded from definition.title
  currentStep: number; // the step currently displayed
  stepIdReached: number; // furthest step reached (controls canJumpTo)
  metadata: Record<string, unknown> | null; // from import-config response
  metadataValidated: boolean;
  credentialsProvided: boolean; // OIDC credentials step
  connectionTested: boolean; // LDAP connection test
  authTested: boolean; // LDAP bind test
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  result: string | null;
  idpTestLink: string | null;
  formValues: Record<string, unknown>; // accumulated by saveForm actions
  succeededForms: Record<string, boolean>; // keyed by formKey
  clientId: string | null;
  clientSecret: string | null;
}
```

`WizardAction` covers step navigation (`ADVANCE_STEP`), validation flags (`METADATA_VALIDATED`, `CREDENTIALS_PROVIDED`, `CONNECTION_TESTED`, `AUTH_TESTED`, `SCHEMA_SAVED`), form state (`SET_METADATA`, `SET_DISPLAY_NAME`, `SAVE_FORM_VALUES`, `FORM_SUCCEEDED`), and submission (`SUBMIT_START`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`, `CLEAR_ERROR`, `RESET_SUBMITTING`). `src/context/WizardContext.tsx` is the source of truth.

---

## Alias lifecycle

Aliases give each wizard session a unique Keycloak IDP alias (e.g. `generic-saml-a1b2c3`). This prevents collisions when a user abandons a wizard and re-enters.

- Generated on wizard entry via `getOrCreateAlias(sessionKey, prefix)` in `src/lib/alias.ts`
- Stored in `sessionStorage` — survives page refresh within the same tab, auto-cleared on tab close
- Cleared explicitly by the `clearAlias` action after successful IDP creation

Session key format: `p2_{providerId}_{protocol}` — e.g. `p2_saml_saml`, `p2_okta_saml`.

---

## Wizard config (realm attributes)

`useWizardConfig()` fetches `config.json` for the target realm (`{serverUrl}/realms/{targetRealm}/wizard/config.json`) on load. This endpoint is served by the Keycloak extension and contains realm-level settings:

```ts
interface WizardConfig {
  appName: string | null; // displayed above the provider selector card
  logoUrl: string | null; // displayed above the provider selector card
  logoUrlLight: string | null; // optional light-mode override
  logoUrlDark: string | null; // optional dark-mode override
  displayName: string;
  apiMode: "cloud" | "onprem" | "";
  emailAsUsername: boolean; // affects SAML attribute mapper creation
  usernameMapperImport: boolean; // IMPORT vs. INHERIT sync mode on the username mapper
  enableDashboard: boolean;
  enableLdap: boolean;
  enableGroupMapping: boolean;
  trustEmail: boolean; // passed to IDP creation payload
}
```

If the endpoint is unreachable (local dev without the extension), all values fall back to safe defaults. The logo falls back to `/phasetwo-logos/{light|dark}/logo_phase_slash.svg`.

---

## Provider selector (index route)

- Centered card (`max-w-sm`, `rounded-xl`, `shadow-md`) on a flex-centered page
- Phase Two slash logo + optional `appName` above the card (from `useWizardConfig`)
- Search input with Fuse.js fuzzy matching (threshold 0.4, key: `name`)
- Scrollable list (`max-h-72`, ~6 items visible at once)
- Two groups: **Providers** (specific) → divider → **Generic** (saml/oidc/ldap)
- Protocol badges: `saml`=blue, `oidc`=emerald, `ldap`=amber
- "Not sure where to start?" link below the card → Dialog with step-by-step instructions
- Single-protocol providers navigate directly to `/wizard/$providerId/$protocol`
- Multi-protocol providers navigate to `/wizard/$providerId` (protocol picker)
- `org_id` search param is forwarded through all navigation calls

---

## v1 → v2 patterns reference

| v1 pattern                                                | v2 equivalent                                                |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| Redux store + `state.settings.currentOrg`                 | `?org_id` URL search param                                   |
| Redux `state.settings.apiMode`                            | Derived in `useWizardApi` from `org_id` + config             |
| Keycloak JS adapter (`keycloak.token`)                    | `oidc-spa` `getOidc().getAccessToken()`                      |
| `Axios` interceptor with Bearer token                     | `openapi-fetch` middleware (same pattern)                    |
| `getAlias()` in `localStorage`                            | `getOrCreateAlias()` in `sessionStorage`                     |
| `CreateIdp()` / `SamlAttributeMapper()` utility functions | `orgsClient.POST(...)` / `adminClient.POST(...)` typed calls |
| Per-provider React component trees                        | Single `WizardRunner` + JSON wizard definition               |
| RTK Query hooks for feature flags                         | `useWizardConfig()` hook                                     |
| `usePrompt` for leave warning                             | `useUnsavedChangesGuard()` (TanStack Router `useBlocker`)    |
| `useCreateTestIdpLink`                                    | `src/lib/idp-test-link.ts` (via the `idp-tester` client)     |

---

## Current state

wizard-v2 is the default frontend. The runner, action executor (HTTP calls, `then` chaining, `foreach`, `mergeIntoMetadata`, `saveForm`, LDAP `testLdapConnection` / `createComponent` / `triggerSync`), block and form renderers, step navigation with `enableNextWhen` gating, leave-wizard prompt, IdP test link, and the `emailAsUsername`, `usernameMapperImport`, and `trustEmail` realm flags are all implemented. Per-provider review status is tracked in the root README's "Wizard implementation status" table.

Known gaps:

- **Setup dashboard** — v1's view of existing setup (`enableDashboard`) has no v2 equivalent.
- **SCIM wizards** — `scim/scim.json`, `entraid/scim.json`, and `okta/scim.json` exist but are still in progress.
- **Okta LDAP auto-fill** — v1 derived DN fields from the `*.ldap.okta.com` host; v2 uses placeholders instead (see `wizards/okta/README.md`).

---

## Testing

Commands run from `apps/wizard-v2/`; details are in [README.md](README.md#testing).

- `pnpm test:e2e` — mock mode, no Keycloak needed. OIDC is mocked and API calls are intercepted with `page.route()`. Run this for every change.
- `pnpm test:integration` — real Keycloak (`docker compose up -d` in `docker/` first); adds `auth.setup.ts`, `global-setup.ts`, and `organizations.spec.ts`.
- `pnpm test:external` — opt-in full loops against real Auth0 / Okta tenants; skipped unless their credentials are exported.
- `pnpm build` (runs `tsc -b`) and `pnpm lint` — there is no separate unit-test runner.

The repo's GitHub Actions CI runs the Maven build only, so run the Playwright suites locally. When adding a wizard JSON, add its route to the load smoke tests in `e2e/wizard-completion.spec.ts`.

---

## Key decisions and rationale

**No Redux in v2.** The Phase Two dashboard uses RTK Query because it has complex server state with caching needs. The wizard is a linear flow — `useReducer` is sufficient and keeps the dependency footprint small.

**`openapi-fetch` over hand-written URLs.** Eliminates a category of bugs (wrong path, wrong body shape) and auto-updates when specs change. The same OpenAPI specs used by the Phase Two dashboard.

**`sessionStorage` for alias.** v1 used `localStorage` which could leave stale aliases across browser sessions. `sessionStorage` scopes to the tab, so a new session always starts fresh.

**JSON schema drives the wizard, not code.** The `actions` block in the JSON declares what API calls each step makes. The runner interprets this — the JSON author doesn't write API code. This is the core architectural bet of v2.

**`org_id` in the URL, not a cookie or context.** Makes the wizard linkable from an org context (dashboard can link directly to the wizard with the org pre-scoped), and the URL is the single source of truth.

**oidc-spa without `withExpectedDecodedIdTokenShape`.** Keycloak token schemas vary by realm configuration and Phase Two extensions. Skipping schema validation avoids runtime errors on unpredictable token fields. Add schema validation back only if specific fields are actively required and reliably present.

**`$providerId` route does NOT redirect to `$protocol`.** This was originally in the `beforeLoad` for convenience (auto-skip the protocol picker for single-protocol providers). It was removed because `$protocol` is a child route of `$providerId` in the TanStack Router tree — the parent `beforeLoad` runs on child navigation too, causing an infinite redirect loop. The index page handles the single-protocol shortcut instead.
