# wizard-v2 — Agent Context

This file is the authoritative context document for AI agents working on wizard-v2. Read it before making changes. It covers architecture decisions, key patterns, current state, and what comes next.

---

## What this project is

wizard-v2 is a rewrite of the Phase Two IDP (Identity Provider) Wizard — a Keycloak extension that guides administrators through connecting an external identity provider (Okta, Entra ID, Google, etc.) to a Keycloak realm.

**The core goal:** replace per-provider React component trees (wizard-v1) with a declarative JSON-driven model. Each wizard is a JSON file. A generic runtime engine reads the JSON and renders the wizard. Adding a new provider = writing a new JSON file, not writing new components.

**Deployment context:** wizard-v2 is a Vite SPA bundled into a Keycloak JAR via Maven's `frontend-maven-plugin`. When deployed, it runs inside Keycloak at a URL like `https://keycloak.example.com/realms/{realm}/wizard/`. The root `pom.xml` controls which app gets built into the JAR (`workingDirectory` in the Maven config — currently pointing at `apps/wizard-v1`; switch to `apps/wizard-v2` when ready).

---

## Monorepo structure

```
idp-wizard/                        ← Maven project root
├── pom.xml                        ← Maven build; workingDirectory selects which app builds
├── pnpm-workspace.yaml            ← pnpm workspace: apps/*
├── apps/
│   ├── wizard-v1/                 ← PatternFly + webpack + Redux (production)
│   └── wizard-v2/                 ← Vite + shadcn + Tailwind (in development)
└── README.md
```

All work described in this file is inside `apps/wizard-v2/`.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 8 | Fast, modern, ESM-native |
| UI | React 19 + shadcn/ui (new-york) | Component library matching Phase Two dashboard-v2 |
| Styling | Tailwind CSS v4 | CSS-first, no separate config file; OKLCH color tokens |
| Routing | TanStack Router (file-based) | Full type-safe routing with `validateSearch`, `beforeLoad` |
| Auth | oidc-spa v10 | OIDC against Keycloak; `withAutoLogin()`, no token schema |
| API types | openapi-typescript + openapi-fetch | Typed clients from OpenAPI specs, no Redux needed |
| State | useReducer (local to wizard runner) | Lightweight; no Redux, no global store |
| Testing | Playwright | E2E, Page Object Model |

---

## File structure

```
apps/wizard-v2/
├── docker/
│   ├── docker-compose.yml            # Dev Keycloak (Phase Two image, pre-configured)
│   └── realm-export.json             # Auto-imported: realm "wizard", client "wizard-v2-dev", test user
├── e2e/
│   ├── fixtures/test.ts              # Extended Playwright fixture with typed page objects
│   ├── pages/
│   │   ├── ProviderSelectorPage.ts   # Page object: landing page
│   │   └── WizardPage.ts            # Page object: wizard + protocol picker
│   └── provider-selector.spec.ts     # Smoke tests (navigation, search, help dialog)
├── openapi-codegen/
│   └── gen.ts                        # Fetches both OpenAPI specs and generates src/api/types/
├── public/
│   ├── favicons/                     # Browser favicon assets
│   ├── phasetwo-logos/               # Phase Two brand SVGs (logo_phase_slash.svg is default)
│   ├── provider-logos/               # Per-provider logos for the selector UI
│   └── wizards/                      # Step screenshots: /wizards/{provider}/saml/step1.png etc.
├── src/
│   ├── api/
│   │   ├── clients.ts                # createOrgsClient() + createAdminClient() — typed, auth-injecting
│   │   └── types/
│   │       ├── orgs.d.ts             # Generated: Phase Two Orgs API (org-scoped IDPs)
│   │       └── admin.d.ts            # Generated: Keycloak Admin API (realm-wide IDPs)
│   ├── components/ui/                # shadcn/ui components (button, dialog, input, …)
│   ├── context/
│   │   └── WizardContext.tsx         # WizardContextValue, WizardState, WizardAction, wizardReducer
│   ├── data/
│   │   └── providers.ts              # Provider registry: id, name, logo, protocols[]
│   ├── hooks/
│   │   ├── useWizardConfig.ts        # Fetches {issuerUri}/wizard/config.json (logoUrl, appName, apiMode…)
│   │   └── useWizardApi.ts           # Derives API context from env + orgId + config
│   ├── lib/
│   │   ├── alias.ts                  # getOrCreateAlias() + clearAlias() — sessionStorage
│   │   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   ├── routes/
│   │   ├── __root.tsx                                    # Root: OidcInitializationGate + devtools
│   │   ├── _authenticated.tsx                            # Layout: home button (hidden on index)
│   │   ├── _authenticated.index.tsx                      # Provider selector (/)
│   │   ├── _authenticated.wizard.$providerId.tsx         # Protocol picker
│   │   └── _authenticated.wizard.$providerId.$protocol.tsx  # Wizard runner ← main work area
│   ├── index.css                     # Tailwind v4 + Phase Two OKLCH color tokens
│   ├── main.tsx                      # RouterProvider entry point
│   └── oidc.ts                       # oidc-spa: useOidc, fetchWithAuth, OidcInitializationGate
├── wizards/
│   ├── saml/
│   │   └── saml.json                 # Generic SAML wizard (id="saml") ← canonical schema reference
│   ├── openid/
│   │   └── oidc.json                 # Generic OpenID wizard (id="openid") — not yet written
│   ├── ldap/
│   │   └── ldap.json                 # Generic LDAP wizard (id="ldap") — not yet written
│   └── {providerId}/
│       └── {protocol}.json           # e.g. okta/saml.json, entraid/saml.json — not yet written
├── .env.local.sample                 # Environment variable template
├── components.json                   # shadcn/ui config
├── playwright.config.ts              # Playwright E2E config (mock OIDC, auto-starts Vite)
└── AGENTS.md                         # ← this file
```

---

## Environment

```
VITE_OIDC_USE_MOCK=true              # Skip Keycloak entirely (UI-only dev)
VITE_OIDC_ISSUER_URI=http://localhost:8080/realms/wizard
VITE_OIDC_CLIENT_ID=wizard-v2-dev
VITE_OIDC_SPA_DEBUG=false
```

Parse `VITE_OIDC_ISSUER_URI` to get `serverUrl` and `realm` — the regex in `useWizardApi.ts` handles both `/auth/realms/` (legacy) and `/realms/` (modern) Keycloak paths.

Dev Keycloak: `cd docker && docker compose up`
Test user: `wizard` / `password` with `realm-admin` role.

---

## Routing

TanStack Router file-based routing. The flat file naming convention uses dots for path segments:

| File | Route |
|---|---|
| `_authenticated.tsx` | Layout wrapper (no path segment, pathless) |
| `_authenticated.index.tsx` | `/` |
| `_authenticated.wizard.$providerId.tsx` | `/wizard/:providerId` |
| `_authenticated.wizard.$providerId.$protocol.tsx` | `/wizard/:providerId/:protocol` |

**Critical gotcha — parent `beforeLoad` runs for child routes.** `$protocol` is a child of `$providerId` in the route tree. So the `$providerId` route's `beforeLoad` runs when navigating to `/wizard/adfs/saml`. Do not add redirects in `$providerId`'s `beforeLoad` that could target child routes — this causes infinite redirect loops. The `$providerId` route's `beforeLoad` only validates that the provider exists.

**Search params** (`?org_id=...`) are declared via `validateSearch: z.object({ org_id: z.string().optional() })` on each route that needs them (index, `$providerId`, `$protocol`). The `org_id` is passed forward through navigation calls so it persists across the full wizard flow.

---

## Organization context

When the wizard is launched from a Phase Two organization (e.g., from the dashboard), `?org_id=abc123` is appended to the URL.

- **`org_id` present → `apiMode: "cloud"`** → uses Phase Two Orgs API at `/{realm}/orgs/{orgId}/idps/...`
- **`org_id` absent → `apiMode: "onprem"`** → uses Keycloak Admin API at `/admin/realms/{realm}/identity-provider/...`

The `apiMode` can also be set via the realm config (`config.apiMode` from `useWizardConfig`), but `org_id` in the URL always takes precedence.

Both endpoint sets are fully typed via the generated OpenAPI clients.

---

## API clients

Two typed clients are available on `WizardContext`:

```ts
const { orgsClient, adminClient, activeClient, realm, orgId } = useWizardContext();

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
  }
);
```

Types are generated from the OpenAPI specs. Regenerate with `pnpm gen-api` when upstream specs change. The generated files (`src/api/types/orgs.d.ts`, `admin.d.ts`) are committed.

Key endpoints:

| Action | Cloud path | Onprem path |
|---|---|---|
| Validate metadata | `POST /{realm}/orgs/{orgId}/idps/import-config` | `POST /admin/realms/{realm}/identity-provider/import-config` |
| Create IDP | `POST /{realm}/orgs/{orgId}/idps` | `POST /admin/realms/{realm}/identity-provider/instances` |
| Add mapper | `POST /{realm}/orgs/{orgId}/idps/{alias}/mappers` | `POST /admin/realms/{realm}/identity-provider/instances/{alias}/mappers` |

---

## Wizard JSON schema (`wizards/generic/saml.json`)

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
    "hideOnLogin": true,
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
- `text` — `{ type: "text", content: "..." }`
- `copy` — copyable value: `{ type: "copy", label: "ACS URL", value: "{{api.ssoUrl}}", hint: "..." }`
- `formGroup` — renders a tabbed/exclusive set of forms: `{ type: "formGroup", id: "metadataInput", exclusive: true, forms: ["metadataUrl", "metadataFile", "metadataManual"] }`
- `attributeTable` — two-column mapping display
- `confirm` — final step confirmation button + result display

### Template variables available in blocks and actions

| Variable | Resolves to |
|---|---|
| `{{api.entityId}}` | `{serverUrl}/realms/{realm}` |
| `{{api.ssoUrl}}` | `{serverUrl}/realms/{realm}/broker/{alias}/endpoint` |
| `{{api.samlMetadata}}` | `{serverUrl}/realms/{realm}/protocol/saml/descriptor` |
| `{{api.adminLinkSaml}}` | Keycloak admin console link for the SAML IDP |
| `{{api.adminLinkOidc}}` | Keycloak admin console link for the OIDC IDP |
| `{{alias}}` | The generated alias for this wizard session |
| `{{state.metadata}}` | The validated IDP config object from `import-config` |
| `{{form.fieldId}}` | A field value from the currently active form |
| `{{item.*}}` | Current item in a `foreach` action iteration |

### Forms

Each form in the `forms` dictionary has:
- `title`, `description`
- `fields` — array of `{ id, type, label, required, placeholder?, accept?, ... }`
  - Field types: `text`, `url`, `file`
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

Special action types (no `endpoint`):
- `{ "type": "clearAlias" }` — removes alias from sessionStorage

---

## Wizard state (useReducer)

State lives in `WizardContext` and is managed by `wizardReducer` in `src/context/WizardContext.tsx`.

```ts
interface WizardState {
  alias: string;             // stable for the session
  currentStep: number;       // the step currently displayed
  stepIdReached: number;     // furthest step reached (controls canJumpTo)
  metadata: Record<string, unknown> | null;  // from import-config response
  metadataValidated: boolean;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  result: string | null;
  idpTestLink: string | null;
}

type WizardAction =
  | { type: "ADVANCE_STEP"; toStep: number }
  | { type: "SET_METADATA"; metadata: Record<string, unknown> }
  | { type: "METADATA_VALIDATED" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; result: string; idpTestLink?: string }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "CLEAR_ERROR" };
```

---

## Alias lifecycle

Aliases give each wizard session a unique Keycloak IDP alias (e.g. `generic-saml-a1b2c3`). This prevents collisions when a user abandons a wizard and re-enters.

- Generated on wizard entry via `getOrCreateAlias(sessionKey, prefix)` in `src/lib/alias.ts`
- Stored in `sessionStorage` — survives page refresh within the same tab, auto-cleared on tab close
- Cleared explicitly by the `clearAlias` action after successful IDP creation

Session key format: `p2_{providerId}_{protocol}` — e.g. `p2_saml_saml`, `p2_okta_saml`.

---

## Wizard config (realm attributes)

`useWizardConfig()` fetches `{issuerUri}/wizard/config.json` on load. This endpoint is served by the Keycloak extension and contains realm-level settings:

```ts
interface WizardConfig {
  appName: string | null;      // displayed above the provider selector card
  logoUrl: string | null;      // displayed above the provider selector card
  displayName: string;
  apiMode: "cloud" | "onprem" | "";
  emailAsUsername: boolean;    // affects SAML attribute mapper creation
  enableDashboard: boolean;
  enableLdap: boolean;
  enableGroupMapping: boolean;
  trustEmail: boolean;         // passed to IDP creation payload
}
```

If the endpoint is unreachable (local dev without the extension), all values fall back to safe defaults. The logo falls back to `/phasetwo-logos/logo_phase_slash.svg`.

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

| v1 pattern | v2 equivalent |
|---|---|
| Redux store + `state.settings.currentOrg` | `?org_id` URL search param |
| Redux `state.settings.apiMode` | Derived in `useWizardApi` from `org_id` + config |
| Keycloak JS adapter (`keycloak.token`) | `oidc-spa` `getOidc().getAccessToken()` |
| `Axios` interceptor with Bearer token | `openapi-fetch` middleware (same pattern) |
| `getAlias()` in `localStorage` | `getOrCreateAlias()` in `sessionStorage` |
| `CreateIdp()` / `SamlAttributeMapper()` utility functions | `orgsClient.POST(...)` / `adminClient.POST(...)` typed calls |
| Per-provider React component trees | Single `WizardRunner` + JSON wizard definition |
| RTK Query hooks for feature flags | `useWizardConfig()` hook |
| `usePrompt` for leave warning | Not yet implemented in v2 |
| `useCreateTestIdpLink` | Not yet implemented in v2 |

---

## What is built

- [x] Vite + React + Tailwind v4 + shadcn/ui project
- [x] pnpm workspace monorepo (v1 and v2 side by side)
- [x] TanStack Router file-based routing
- [x] oidc-spa authentication (mock mode + real Keycloak)
- [x] Dev Keycloak via Docker Compose (Phase Two image, auto-imported realm)
- [x] Provider selector UI (fuzzy search, protocol badges, grouped list, help dialog)
- [x] Protocol picker route
- [x] Org context (`org_id` search param, apiMode switching)
- [x] WizardContext with useReducer state
- [x] Alias management (sessionStorage)
- [x] useWizardApi — derives all API context from env + org_id + config
- [x] Typed API clients (openapi-fetch + generated types from Phase Two + Keycloak OpenAPI specs)
- [x] Wizard JSON schema (defined and documented, `wizards/generic/saml.json`)
- [x] Playwright E2E scaffold (Page Object Model, mock OIDC, smoke tests)
- [x] Home/back button in layout when inside a wizard

## What is not yet built

- [ ] **Wizard runner** — the component that reads a wizard JSON file and renders steps, forms, and blocks. This is the main remaining work.
- [ ] **Action executor** — the runtime that resolves template variables and executes `actions` from the JSON (makes API calls, dispatches reducer actions, chains follow-up actions)
- [ ] **Block renderers** — React components for each block type: `text`, `copy`, `formGroup`, `attributeTable`, `confirm`
- [ ] **Form renderer** — renders form fields from the JSON `forms` dictionary, handles validation and submission
- [ ] **Step navigation UI** — sidebar/stepper nav, next/back buttons, `enableNextWhen` gating
- [ ] **Company-specific wizard JSON files** — `wizards/okta/saml.json`, `wizards/entraid/saml.json`, etc.
- [ ] **OIDC wizard JSON** — `wizards/generic/oidc.json` (different flow: discovery URL + client credentials)
- [ ] **LDAP wizard JSON** — `wizards/generic/ldap.json` (different API: LDAP component, not IDP)
- [ ] **Leave-wizard confirmation prompt** (v1 used `usePrompt`)
- [ ] **IDP test link** (post-creation link to test the IDP login, v1 used `useCreateTestIdpLink`)
- [ ] **`emailAsUsername` + `usernameMapperImport` flag handling** in the mapper action

---

## Key decisions and rationale

**No Redux in v2.** The dashboard-v2 uses RTK Query because it has complex server state with caching needs. The wizard is a linear flow — `useReducer` is sufficient and keeps the dependency footprint small.

**`openapi-fetch` over hand-written URLs.** Eliminates a category of bugs (wrong path, wrong body shape) and auto-updates when specs change. The same OpenAPI specs used by dashboard-v2.

**`sessionStorage` for alias.** v1 used `localStorage` which could leave stale aliases across browser sessions. `sessionStorage` scopes to the tab, so a new session always starts fresh.

**JSON schema drives the wizard, not code.** The `actions` block in the JSON declares what API calls each step makes. The runner interprets this — the JSON author doesn't write API code. This is the core architectural bet of v2.

**`org_id` in the URL, not a cookie or context.** Makes the wizard linkable from an org context (dashboard can link directly to the wizard with the org pre-scoped), and the URL is the single source of truth.

**oidc-spa without `withExpectedDecodedIdTokenShape`.** Keycloak token schemas vary by realm configuration and Phase Two extensions. Skipping schema validation avoids runtime errors on unpredictable token fields. Add schema validation back only if specific fields are actively required and reliably present.

**`$providerId` route does NOT redirect to `$protocol`.** This was originally in the `beforeLoad` for convenience (auto-skip the protocol picker for single-protocol providers). It was removed because `$protocol` is a child route of `$providerId` in the TanStack Router tree — the parent `beforeLoad` runs on child navigation too, causing an infinite redirect loop. The index page handles the single-protocol shortcut instead.
