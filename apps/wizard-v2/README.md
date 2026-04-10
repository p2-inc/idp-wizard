# wizard-v2

A rewrite of the Phase Two IDP Wizard. Wizards are defined declaratively as JSON files and rendered by a generic runtime engine — no per-provider component trees. This replaces wizard-v1 once complete.

## Stack

- **Vite** — build tooling
- **React 19** — UI
- **Tailwind CSS v4** — styling
- **shadcn/ui** (new-york style) — component library
- **TanStack Router** — file-based routing with full type safety
- **oidc-spa** — OIDC authentication against Keycloak
- **openapi-fetch** — typed HTTP clients generated from OpenAPI specs

## Project structure

```
wizard-v2/
├── docker/
│   ├── docker-compose.yml      # Dev Keycloak (Phase Two image, pre-configured)
│   └── realm-export.json       # Auto-imported on first start: realm, client, test user
├── e2e/
│   ├── fixtures/
│   │   └── test.ts             # Playwright fixture with typed page objects
│   ├── pages/
│   │   ├── ProviderSelectorPage.ts
│   │   └── WizardPage.ts
│   └── provider-selector.spec.ts
├── openapi-codegen/
│   └── gen.ts                  # Generates typed API clients from OpenAPI specs
├── public/
│   ├── favicons/               # Favicon assets
│   ├── phasetwo-logos/         # Phase Two brand assets
│   ├── provider-logos/         # Per-provider logos for the selector UI
│   └── wizards/                # Step screenshots, one folder per provider
├── src/
│   ├── api/
│   │   ├── clients.ts          # createOrgsClient / createAdminClient (openapi-fetch)
│   │   └── types/
│   │       ├── orgs.d.ts       # Generated types — Phase Two Orgs API
│   │       └── admin.d.ts      # Generated types — Keycloak Admin API
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── wizard/
│   │       ├── types.ts        # TypeScript types for wizard JSON schema
│   │       ├── resolveTemplate.ts  # {{token}} template resolver
│   │       ├── executeAction.ts    # Action executor (HTTP calls, alias cleanup)
│   │       ├── WizardRunner.tsx    # Loads JSON, renders steps + navigation
│   │       └── WizardStep.tsx      # Renders individual step blocks
│   ├── context/
│   │   └── WizardContext.tsx   # State, reducer, and React context
│   ├── data/
│   │   └── providers.ts        # Provider registry (id, name, logo, protocols)
│   ├── hooks/
│   │   ├── useWizardApi.ts     # Resolves API clients, endpoints, apiMode
│   │   └── useWizardConfig.ts  # Fetches realm config.json (logoUrl, appName…)
│   ├── lib/
│   │   ├── alias.ts            # sessionStorage alias helpers
│   │   └── utils.ts            # cn() helper (clsx + tailwind-merge)
│   ├── routes/
│   │   ├── __root.tsx                                        # Root — OidcInitializationGate
│   │   ├── _authenticated.tsx                                # Layout — home button header
│   │   ├── _authenticated.index.tsx                          # Provider selector (/)
│   │   ├── _authenticated.wizard.$providerId.tsx             # Layout wrapper — Outlet only
│   │   ├── _authenticated.wizard.$providerId.index.tsx       # Protocol picker
│   │   └── _authenticated.wizard.$providerId.$protocol.tsx   # Wizard page
│   ├── index.css               # Tailwind + Phase Two color scheme (OKLCH tokens)
│   ├── main.tsx                # TanStack RouterProvider entry point
│   └── oidc.ts                 # oidc-spa setup: useOidc, fetchWithAuth, OidcInitializationGate
├── wizards/
│   ├── saml/
│   │   └── saml.json           # Generic SAML wizard definition
│   └── <provider>/
│       └── <protocol>.json     # Provider-specific wizard definitions
├── .env.local.sample           # Environment variable template
├── playwright.config.ts        # Playwright E2E config
└── components.json             # shadcn/ui config
```

## Architecture

Wizards are JSON files in `wizards/`. Each file describes a complete wizard — steps, UI blocks, forms, actions, and API calls — without any bespoke React components. A runtime engine reads the JSON and renders the wizard generically.

This means adding a new identity provider requires only a new JSON file, not a new component tree.

### Wizard JSON schema

Wizard files live at `wizards/{providerId}/{protocol}.json`. The runtime loads the file for the active provider and protocol. If no provider-specific file exists, the wizard shows a "not yet available" message — there is no generic fallback.

Each wizard JSON has four top-level keys:

| Key | Description |
|-----|-------------|
| `steps` | Ordered list of wizard steps, each with an `id`, `title`, optional `enableNextWhen` expression, and a list of `blocks` |
| `forms` | Named form definitions (fields, validation) rendered by `FormGroup` blocks |
| `actions` | Named action definitions (HTTP calls, alias cleanup) invoked on form submit or confirm |
| `alias` | Alias configuration — `sessionKey` for sessionStorage, `prefix` for generated alias strings |

Template tokens in JSON values (`{{api.entityId}}`, `{{form.fieldId}}`, `{{state.metadata}}`, `{{alias}}`, `{{item.*}}`) are resolved at runtime from the wizard context.

## API clients

The wizard uses two typed HTTP clients generated from OpenAPI specs — one for the Phase Two Orgs API (cloud/organization mode) and one for the Keycloak Admin API (on-premises/realm-wide mode). Both are created in `src/api/clients.ts` using [openapi-fetch](https://openapi-ts.dev/openapi-fetch/).

### Regenerating types

```bash
npx tsx openapi-codegen/gen.ts
```

This fetches the latest specs and writes:
- `src/api/types/orgs.d.ts` — Phase Two Orgs API types
- `src/api/types/admin.d.ts` — Keycloak Admin API types

### Cloud vs. on-premises mode

The wizard operates in one of two API modes depending on how it is launched:

| Mode | Trigger | API used | Endpoint pattern |
|------|---------|---------|-----------------|
| **cloud** | `?org_id=<id>` present in URL | Phase Two Orgs API | `/{realm}/orgs/{orgId}/idps/...` |
| **onprem** | No `org_id` param | Keycloak Admin API | `/admin/realms/{realm}/identity-provider/...` |

`useWizardApi` (in `src/hooks/useWizardApi.ts`) inspects the `org_id` search param to set `apiMode` and resolves the correct endpoint URLs and typed client for each mode. The wizard JSON actions reference named endpoint slots (`importConfig`, `createIdp`, `addMappers`) rather than raw URLs — these are resolved to the correct mode-specific URLs at runtime.

### Endpoint reference

| Slot | Cloud URL | On-prem URL |
|------|-----------|-------------|
| `importConfig` | `POST /{realm}/orgs/{orgId}/idps/import-config` | `POST /admin/realms/{realm}/identity-provider/import-config` |
| `createIdp` | `POST /{realm}/orgs/{orgId}/idps` | `POST /admin/realms/{realm}/identity-provider/instances` |
| `addMappers` | `POST /{realm}/orgs/{orgId}/idps/{alias}/mappers` | `POST /admin/realms/{realm}/identity-provider/instances/{alias}/mappers` |

### Realm and server URL

Both are parsed from `VITE_OIDC_ISSUER_URI` at startup. The parser handles both legacy Keycloak paths (`/auth/realms/<realm>`) and modern paths (`/realms/<realm>`).

### Realm config

`useWizardConfig` fetches `{issuerUri}/wizard/config.json` and exposes optional realm-level overrides:

| Key | Description |
|-----|-------------|
| `logoUrl` | Replaces the Phase Two slash logo on the provider selector |
| `appName` | Shown above the provider search card |
| `apiMode` | Override the auto-detected mode (`"cloud"` or `"onprem"`) |
| `emailAsUsername` | Adds an email→username mapper when creating the IDP |

If the file is missing or the fetch fails, defaults are used silently.

## IDP alias

Each wizard session generates a unique IDP alias (e.g. `saml-saml-a1b2c3`) stored in `sessionStorage`. The alias is:

- Stable for the duration of the browser tab/session
- Used as the IDP identifier in all API calls during the wizard
- Cleared from `sessionStorage` on successful wizard completion (via the `clearAlias` action)
- Scoped per provider+protocol pair so multiple concurrent wizard sessions don't collide

## Local development

### 1. Environment

Copy the env sample. The defaults match the local Docker Keycloak setup:

```bash
cp .env.local.sample .env.local
```

| Variable               | Default                                     | Description                             |
| ---------------------- | ------------------------------------------- | --------------------------------------- |
| `VITE_OIDC_USE_MOCK`   | `false`                                     | Set to `true` to skip Keycloak entirely |
| `VITE_OIDC_ISSUER_URI` | `http://localhost:8080/auth/realms/wizard`  | Keycloak realm URL                      |
| `VITE_OIDC_CLIENT_ID`  | `wizard-v2-dev`                             | Keycloak client ID                      |
| `VITE_OIDC_SPA_DEBUG`  | `false`                                     | Enable verbose oidc-spa logs            |

### 2. Start Keycloak

```bash
cd docker
docker compose up
```

On first run, Keycloak auto-imports `realm-export.json` which creates:

- **Realm:** `wizard`
- **Client:** `wizard-v2-dev` (public, redirect URI: `http://localhost:5173/*`)
- **Test user:** see below

Keycloak data persists in a named Docker volume between restarts.

> If the volume already exists from a previous run with bad state, recreate it cleanly:
> ```bash
> docker compose down -v && docker compose up
> ```

#### Dev test user

| Field     | Value      |
| --------- | ---------- |
| Username  | `wizard`   |
| Password  | `password` |
| Email     | `wizard@example.com` |
| Roles     | `realm-admin` (via `realm-management` client) |

This user has full `realm-admin` permissions, which the wizard requires in order to create identity providers via the Keycloak Admin API.

### 3. Start the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:5173`. Log in with `wizard` / `password`.

To test organization (cloud) mode, append `?org_id=<your-org-id>` to the URL. The debug strip in dev mode shows the resolved `apiMode`, `orgId`, `realm`, alias, and endpoint URLs.

### Mock mode

To work on UI without a running Keycloak instance, set `VITE_OIDC_USE_MOCK=true` in `.env.local`. oidc-spa returns a mock authenticated user and all auth flows are bypassed.

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add button
```

Components are added to `src/components/ui/` and automatically use the Phase Two color scheme defined in `src/index.css`.

## Static assets

Assets in `public/` are served at the root path with no imports required.

| Path                   | Usage                                              |
| ---------------------- | -------------------------------------------------- |
| `/favicons/`           | Browser favicon assets                             |
| `/phasetwo-logos/`     | Phase Two brand SVGs                               |
| `/provider-logos/`     | Provider logos used in the selector UI             |
| `/wizards/<provider>/` | Step screenshots referenced from wizard JSON files |

Example reference in a wizard JSON: `"/wizards/okta/saml/step1.png"`

## Testing

E2E tests use [Playwright](https://playwright.dev/) and run against the Vite dev server with OIDC in mock mode — no live Keycloak required.

```bash
# Run all tests headlessly
pnpm test:e2e

# Open interactive Playwright UI (great for writing tests)
pnpm test:e2e:ui

# View the last HTML report
pnpm test:e2e:report
```

### Test structure

```
e2e/
├── fixtures/
│   └── test.ts               # Extended test fixture with typed page objects
├── pages/
│   ├── ProviderSelectorPage.ts   # Selectors and actions for the landing page
│   └── WizardPage.ts             # Selectors and actions for wizard/picker views
└── provider-selector.spec.ts     # Smoke tests: navigation, search, help dialog
```

Tests follow the [Page Object Model](https://playwright.dev/docs/pom) pattern. Add a new `*.spec.ts` alongside a matching page object in `e2e/pages/` as wizard steps are built out. Real wizard step tests should wait until the wizard JSON configuration format is settled.

### CI

In CI (`CI=true`), the web server is always started fresh, tests are retried up to 2 times, and the reporter uses GitHub annotations.

## Building

```bash
pnpm build
```

Output goes to `dist/`. When wizard-v2 is ready for production, the root `pom.xml` `workingDirectory` will be updated to `apps/wizard-v2` and `mvn package` will bundle it into the Keycloak JAR.
