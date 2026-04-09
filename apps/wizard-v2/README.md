# wizard-v2

A rewrite of the Phase Two IDP Wizard. Wizards are defined declaratively as JSON files and rendered by a generic runtime engine — no per-provider component trees. This replaces wizard-v1 once complete.

## Stack

- **Vite** — build tooling
- **React 19** — UI
- **Tailwind CSS v4** — styling
- **shadcn/ui** (new-york style) — component library
- **TanStack Router** — file-based routing with full type safety
- **oidc-spa** — OIDC authentication against Keycloak

## Project structure

```
wizard-v2/
├── docker/
│   ├── docker-compose.yml      # Dev Keycloak (Phase Two image, pre-configured)
│   └── realm-export.json       # Auto-imported on first start: realm, client, test user
├── public/
│   ├── favicons/               # Favicon assets
│   ├── phasetwo-logos/         # Phase Two brand assets
│   ├── provider-logos/         # Per-provider logos for the selector UI
│   └── wizards/                # Step screenshots, one folder per provider
├── src/
│   ├── lib/
│   │   └── utils.ts            # cn() helper (clsx + tailwind-merge)
│   ├── routes/
│   │   ├── __root.tsx          # Root route — wraps app in OidcInitializationGate
│   │   └── index.tsx           # Provider selector (/)
│   ├── index.css               # Tailwind + Phase Two color scheme (OKLCH tokens)
│   ├── main.tsx                # TanStack RouterProvider entry point
│   └── oidc.ts                 # oidc-spa setup: useOidc, fetchWithAuth, OidcInitializationGate
├── wizards/
│   └── generic-saml.json       # Declarative wizard definition (SAML)
├── .env.local.sample           # Environment variable template
└── components.json             # shadcn/ui config
```

## Architecture

Wizards are JSON files in `wizards/`. Each file describes a complete wizard — steps, UI blocks, forms, actions, and API calls — without any bespoke React components. A runtime engine (in development) reads the JSON and renders the wizard generically.

This means adding a new identity provider requires only a new JSON file, not a new component tree.

See `wizards/generic-saml.json` for a working example of the schema.

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
- **Test user:** `wizard` / `password` with `realm-admin` permissions

Keycloak data persists in a named Docker volume between restarts.

### 3. Start the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:5173`. Log in with `wizard` / `password`.

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

## Building

```bash
pnpm build
```

Output goes to `dist/`. When wizard-v2 is ready for production, the root `pom.xml` `workingDirectory` will be updated to `apps/wizard-v2` and `mvn package` will bundle it into the Keycloak JAR.
