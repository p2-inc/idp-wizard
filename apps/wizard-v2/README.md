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
│   ├── .auth/                  # Saved login state (gitignored); .gitkeep tracks the dir
│   ├── external-providers/
│   │   ├── Auth0Page.ts        # POM for Auth0 Dashboard
│   │   ├── OktaPage.ts         # POM for Okta Admin Console
│   │   └── external-provider.spec.ts
│   ├── fixtures/
│   │   ├── test.ts             # Playwright fixture with typed page objects
│   │   └── test-saml-metadata.xml  # Minimal SAML metadata for file upload tests
│   ├── pages/
│   │   ├── KeycloakLoginPage.ts
│   │   ├── ProviderSelectorPage.ts
│   │   └── WizardPage.ts
│   ├── auth.setup.ts           # OIDC login setup — saves storage state
│   ├── global-setup.ts         # Creates orgs + assigns users (integration mode)
│   ├── organizations.spec.ts   # Org management + org-scoped wizard tests
│   ├── provider-selector.spec.ts
│   └── wizard-completion.spec.ts  # Full flow tests for all 21 wizards
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

| Key       | Description                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `steps`   | Ordered list of wizard steps, each with an `id`, `title`, optional `enableNextWhen` expression, and a list of `blocks` |
| `forms`   | Named form definitions (fields, validation) rendered by `FormGroup` blocks                                             |
| `actions` | Named action definitions (HTTP calls, alias cleanup) invoked on form submit or confirm                                 |
| `alias`   | Alias configuration — `sessionKey` for sessionStorage, `prefix` for generated alias strings                            |

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

| Mode       | Trigger                       | API used           | Endpoint pattern                              |
| ---------- | ----------------------------- | ------------------ | --------------------------------------------- |
| **cloud**  | `?org_id=<id>` present in URL | Phase Two Orgs API | `/{realm}/orgs/{orgId}/idps/...`              |
| **onprem** | No `org_id` param             | Keycloak Admin API | `/admin/realms/{realm}/identity-provider/...` |

`useWizardApi` (in `src/hooks/useWizardApi.ts`) inspects the `org_id` search param to set `apiMode` and resolves the correct endpoint URLs and typed client for each mode. The wizard JSON actions reference named endpoint slots (`importConfig`, `createIdp`, `addMappers`) rather than raw URLs — these are resolved to the correct mode-specific URLs at runtime.

### Endpoint reference

| Slot           | Cloud URL                                         | On-prem URL                                                              |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `importConfig` | `POST /{realm}/orgs/{orgId}/idps/import-config`   | `POST /admin/realms/{realm}/identity-provider/import-config`             |
| `createIdp`    | `POST /{realm}/orgs/{orgId}/idps`                 | `POST /admin/realms/{realm}/identity-provider/instances`                 |
| `addMappers`   | `POST /{realm}/orgs/{orgId}/idps/{alias}/mappers` | `POST /admin/realms/{realm}/identity-provider/instances/{alias}/mappers` |

### Realm and server URL

Both are parsed from `VITE_OIDC_ISSUER_URI` at startup. The parser handles both legacy Keycloak paths (`/auth/realms/<realm>`) and modern paths (`/realms/<realm>`).

### Realm config

`useWizardConfig` fetches `{issuerUri}/wizard/config.json` and exposes optional realm-level overrides:

| Key               | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `logoUrl`         | Replaces the Phase Two slash logo on the provider selector |
| `appName`         | Shown above the provider search card                       |
| `apiMode`         | Override the auto-detected mode (`"cloud"` or `"onprem"`)  |
| `emailAsUsername` | Adds an email→username mapper when creating the IDP        |

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

| Variable               | Default                                    | Description                             |
| ---------------------- | ------------------------------------------ | --------------------------------------- |
| `VITE_OIDC_USE_MOCK`   | `false`                                    | Set to `true` to skip Keycloak entirely |
| `VITE_OIDC_ISSUER_URI` | `http://localhost:8080/auth/realms/wizard` | Keycloak realm URL                      |
| `VITE_OIDC_CLIENT_ID`  | `wizard-v2-dev`                            | Keycloak client ID                      |
| `VITE_OIDC_SPA_DEBUG`  | `false`                                    | Enable verbose oidc-spa logs            |

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
>
> ```bash
> docker compose down -v && docker compose up
> ```

#### Dev test users

| Username     | Password   | Email                    | Roles         |
| ------------ | ---------- | ------------------------ | ------------- |
| `wizard`     | `password` | `wizard@example.com`     | `realm-admin` |
| `org-admin`  | `password` | `org-admin@example.com`  | —             |
| `org-member` | `password` | `org-member@example.com` | —             |

`wizard` has full `realm-admin` permissions, which the wizard requires to create identity providers via the Keycloak Admin API. `org-admin` and `org-member` are plain users used by integration tests; `global-setup.ts` assigns them to test organizations at runtime.

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

E2E tests use [Playwright](https://playwright.dev/) and the Page Object Model pattern. There are two test modes — a fast mock mode for everyday development and a full integration mode that drives a real Keycloak server.

### Intent

The test suite is designed to verify the wizard at every layer:

- **UI and navigation** — does the step sequencing work? Are copy blocks, forms, and attribute tables rendered correctly? Does search and help work on the provider selector?
- **Wizard completion** — can each provider's wizard flow be driven from start to finish, including form submission and final IDP creation? This covers all 21 wizard files.
- **API routing** — does the wizard call the right endpoints (org-scoped vs. realm-wide) depending on how it was launched?
- **Organization context** — does the `?org_id=` launch mode work correctly? Are org memberships, roles, and API routes all correct?
- **External provider loop** _(optional)_ — can the browser automate the external provider setup (Auth0, Okta) and feed the resulting credentials directly into the wizard, end-to-end?

### Running tests

```bash
# Fast mock tests — no Keycloak required
pnpm test:e2e

# Interactive Playwright UI
pnpm test:e2e:ui

# View the last HTML report
pnpm test:e2e:report

# Integration tests — requires Keycloak running (see below)
pnpm test:integration

# External provider tests — requires provider credentials in env (see below)
pnpm test:external
```

### Test modes

#### Mock mode (default)

The Vite dev server runs with `VITE_OIDC_USE_MOCK=true` — oidc-spa returns a mock authenticated user and no real Keycloak is needed. Keycloak API calls (import-config, create IDP, add mappers, LDAP test) are intercepted with Playwright's `page.route()` so the full wizard UI flow can be exercised without any server.

The `VITE_OIDC_ISSUER_URI` is still set so the wizard runner can resolve API URLs correctly — even though the calls are intercepted before they reach any real server.

#### Integration mode (`PLAYWRIGHT_INTEGRATION=true`)

Requires Keycloak to be running:

```bash
cd docker && docker compose up -d
```

The Playwright run has three phases:

1. **`auth:setup` project** — opens a browser, follows the OIDC redirect to Keycloak, logs in as `wizard`/`password`, and saves the browser storage state to `e2e/.auth/admin.json`. Subsequent test contexts load this state instead of re-authenticating.
2. **`global-setup.ts`** — runs once before the test suite. Uses the Keycloak admin API to create two test organizations (`test-org-alpha`, `test-org-beta`) and assign the `org-admin` and `org-member` test users to them. Org IDs are exposed via `process.env` so tests can reference them without hardcoding.
3. **Test projects** — run with the saved auth state and real API endpoints.

### Test structure

```
e2e/
├── .auth/
│   └── admin.json              # Saved browser state for integration tests (gitignored)
├── external-providers/
│   ├── Auth0Page.ts            # POM for Auth0 Dashboard (manage.auth0.com)
│   ├── OktaPage.ts             # POM for Okta Admin Console
│   └── external-provider.spec.ts  # Full-loop tests: configure provider, complete wizard
├── fixtures/
│   ├── test.ts                 # Extended Playwright fixture with typed page objects
│   └── test-saml-metadata.xml  # Minimal SAML IdP metadata for file upload tests
├── pages/
│   ├── KeycloakLoginPage.ts    # POM for Keycloak login screen (theme-agnostic)
│   ├── ProviderSelectorPage.ts # POM for the provider selector landing page
│   └── WizardPage.ts           # POM for wizard runner — step nav, forms, confirmation
├── auth.setup.ts               # Playwright setup project: OIDC login, save storage state
├── global-setup.ts             # Pre-suite setup: create orgs, assign users via Orgs API
├── organizations.spec.ts       # Organization membership, ?org_id routing, org-scoped completion
├── provider-selector.spec.ts   # Smoke tests: provider list, search, help dialog, navigation
└── wizard-completion.spec.ts   # Full flow tests for SAML, OIDC, and LDAP wizards
```

### Spec files

#### `provider-selector.spec.ts`

Smoke tests for the landing page and navigation. Runs in mock mode. Covers:

- Provider list renders, fuzzy search works, clearing search restores grouped view
- Help dialog opens and closes
- Single-protocol providers navigate directly to the wizard; multi-protocol providers navigate to the protocol picker
- Home link returns to the provider selector

#### `wizard-completion.spec.ts`

Full wizard flow tests. Runs in mock mode with API interception. Covers:

- **Auth0 SAML** — file upload flow: upload test metadata XML, validate, advance through attribute mapping and user access steps, confirm IDP creation
- **Auth0 OIDC** — credentials flow: fill domain, client ID, and secret, verify against the discovery endpoint, configure redirect URI, confirm
- **Okta LDAP** — connection flow: fill LDAP host and base DN, test connection, fill bind credentials, test authentication, confirm user federation creation
- **All 21 providers** — parametrized "loads without error" tests that navigate to every wizard and assert that at least one step renders. This ensures no wizard JSON has a syntax or schema error.

Back-navigation and `enableNextWhen` gating (Next disabled until validation passes) are also tested.

#### `organizations.spec.ts`

Integration-mode tests (requires Keycloak). Covers:

- Test organizations and memberships created by `global-setup.ts` exist and are correct
- Navigating to `/?org_id=<id>` passes the org ID through to the wizard URL
- Wizard launched with `?org_id=` routes API calls through org-scoped endpoints rather than admin endpoints
- Org admin can complete a full SAML wizard for their organization

#### `external-providers/external-provider.spec.ts`

Full end-to-end tests that drive an external identity provider's admin UI and then complete the corresponding wizard. These are **skipped by default** — they run only when the relevant credential environment variables are set.

Each test follows the same pattern:

1. Open the provider's dashboard and create an application or integration
2. Configure it with the SP values (ACS URL, Entity ID) read from the wizard
3. Copy the resulting metadata URL or credentials
4. Return to the wizard and complete it using those values
5. Assert successful IDP creation

| Test                 | Variables required                              |
| -------------------- | ----------------------------------------------- |
| Auth0 OIDC full loop | `AUTH0_DOMAIN`, `AUTH0_EMAIL`, `AUTH0_PASSWORD` |
| Auth0 SAML full loop | `AUTH0_DOMAIN`, `AUTH0_EMAIL`, `AUTH0_PASSWORD` |
| Okta SAML full loop  | `OKTA_DOMAIN`, `OKTA_EMAIL`, `OKTA_PASSWORD`    |

> These tests create real applications in your provider accounts. Clean them up manually afterward.

### Dev test users

The `wizard` realm is pre-seeded with three test users (created from `docker/realm-export.json`):

| Username     | Password   | Role          | Purpose                                                                            |
| ------------ | ---------- | ------------- | ---------------------------------------------------------------------------------- |
| `wizard`     | `password` | `realm-admin` | Main admin — can call any Keycloak admin API. Used by `auth:setup` and most tests. |
| `org-admin`  | `password` | —             | Org-level admin. Assigned as admin of `test-org-alpha` by `global-setup.ts`.       |
| `org-member` | `password` | —             | Regular org member. Assigned as member of `test-org-alpha` by `global-setup.ts`.   |

### Keycloak admin theme

Both the `wizard` realm and the `master` realm are configured to use the `phasetwo.v2` admin theme. This is set via:

- `adminTheme: "phasetwo.v2"` in `docker/realm-export.json` for the wizard realm
- `docker/master-realm-export.json` (a minimal export mounted alongside the wizard realm) for the master realm — Keycloak merges it into the existing master realm on startup

### CI

In CI (`CI=true`), the web server is always started fresh, tests are retried up to 2 times, and the reporter uses GitHub annotations. Integration tests are not run in CI by default — set `PLAYWRIGHT_INTEGRATION=true` and ensure a Keycloak service is available to enable them.

## Building

```bash
pnpm build
```

Output goes to `dist/`. When wizard-v2 is ready for production, the root `pom.xml` `workingDirectory` will be updated to `apps/wizard-v2` and `mvn package` will bundle it into the Keycloak JAR.

## Migration check

- Existing provider setup is displayed
- Ability to change organizations if you are not in organization mode (as in if you were sent a link generated for a specific org, you can only view that org)

## Wizard Review

- AWS
  - Screenshots on app selection need to be updated
