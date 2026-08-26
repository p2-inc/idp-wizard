/**
 * Runtime configuration.
 *
 * In production the wizard is served by the Keycloak SPI at
 * `{auth-server-url}/realms/{realm}/wizard/`, and a *single* published JAR runs in
 * every realm of every install — hosted and self-hosted alike. Anything baked in at
 * build time would therefore be correct for at most one deployment, so the server is
 * the source of truth: it publishes `keycloak.json` next to the app
 * (see `WizardResourceProvider#keycloakJson`).
 *
 * Two distinct realms are in play, and they are not always the same:
 *
 * - **auth realm** — the realm we authenticate against. Comes from `keycloak.json`'s
 *   `realm`, which the server resolves from the `_providerConfig.wizard.auth-realm-override`
 *   realm attribute, falling back to the current realm.
 * - **target realm** — the realm being configured, i.e. the one in our own URL.
 *
 * Deriving the issuer from `window.location` alone would conflate the two and break
 * every deployment that sets `auth-realm-override`.
 *
 * `vite dev` serves the app from `/`, where neither the realm path nor `keycloak.json`
 * exists, so the `VITE_OIDC_*` variables remain as a development-only fallback.
 */

/** Shape of the SPI-generated `keycloak.json`. */
interface KeycloakJson {
  realm: string;
  "auth-server-url": string;
  resource: string;
}

export interface RuntimeConfig {
  /** Keycloak base URL, no trailing slash. Includes the relative path (e.g. `/auth`) when set. */
  serverUrl: string;
  /** Realm we authenticate against. May differ from `targetRealm`. */
  authRealm: string;
  /** Realm being configured — the one whose IdPs the wizard creates. */
  targetRealm: string;
  /** OIDC client id. */
  clientId: string;
  /** `{serverUrl}/realms/{authRealm}` — what oidc-spa needs. */
  issuerUri: string;
  /** URL path the app is served under, used as the router basepath. */
  basepath: string;
}

const isMock = import.meta.env.VITE_OIDC_USE_MOCK === "true";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Parses a Keycloak issuer URI into its server base URL and realm name.
 * Handles both the legacy /auth prefix and the modern path style.
 *
 *   http://localhost:8080/realms/myrealm       → { serverUrl: "http://localhost:8080", realm: "myrealm" }
 *   http://localhost:8080/auth/realms/myrealm  → { serverUrl: "http://localhost:8080/auth", realm: "myrealm" }
 */
export function parseIssuerUri(issuerUri: string): { serverUrl: string; realm: string } {
  const match = issuerUri.match(/^(https?:\/\/.+?)\/realms\/([^/]+)\/?$/);
  if (match) return { serverUrl: match[1], realm: match[2] };
  return { serverUrl: stripTrailingSlash(issuerUri), realm: "" };
}

/**
 * The path the app is served under. In production the theme template sets
 * `<base href=".../realms/{realm}/wizard/">`; under `vite dev` there is no `<base>`
 * and this resolves to "/". Synchronous, so the router can be built at module scope.
 */
export function getBasepath(): string {
  try {
    return new URL(document.baseURI).pathname || "/";
  } catch {
    return "/";
  }
}

/** Extracts the realm from a `/realms/{realm}/...` path. */
function realmFromPath(pathname: string): string {
  return pathname.match(/\/realms\/([^/]+)(?:\/|$)/)?.[1] ?? "";
}

async function fetchKeycloakJson(): Promise<KeycloakJson | undefined> {
  try {
    const res = await fetch(new URL("keycloak.json", document.baseURI), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return undefined;
    return (await res.json()) as KeycloakJson;
  } catch {
    // No SPI in front of us (dev server) — caller falls back to env.
    return undefined;
  }
}

function fromEnv(basepath: string): RuntimeConfig {
  const envIssuer = import.meta.env.VITE_OIDC_ISSUER_URI as string | undefined;
  const envClientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined;

  if (!envIssuer || !envClientId) {
    if (!isMock) {
      throw new Error(
        "Could not load keycloak.json, and VITE_OIDC_ISSUER_URI / VITE_OIDC_CLIENT_ID are unset. " +
          "In production the wizard must be served by the Keycloak SPI; for local development, " +
          "copy .env.local.sample to .env.local.",
      );
    }
    // Mock mode deliberately runs without a Keycloak; values are unused.
    return {
      serverUrl: "",
      authRealm: "",
      targetRealm: "",
      clientId: "",
      issuerUri: "",
      basepath,
    };
  }

  const { serverUrl, realm } = parseIssuerUri(envIssuer);
  return {
    serverUrl,
    authRealm: realm,
    targetRealm: realmFromPath(basepath) || realm,
    clientId: envClientId,
    issuerUri: stripTrailingSlash(envIssuer),
    basepath,
  };
}

async function resolveRuntimeConfig(): Promise<RuntimeConfig> {
  const basepath = getBasepath();

  // Mock mode never talks to a server.
  if (isMock) return fromEnv(basepath);

  const kc = await fetchKeycloakJson();
  if (!kc?.realm || !kc["auth-server-url"] || !kc.resource) return fromEnv(basepath);

  const serverUrl = stripTrailingSlash(kc["auth-server-url"]);
  return {
    serverUrl,
    authRealm: kc.realm,
    // The realm in our own URL is the one being configured; it differs from the auth
    // realm whenever `_providerConfig.wizard.auth-realm-override` is set.
    targetRealm: realmFromPath(basepath) || kc.realm,
    clientId: kc.resource,
    issuerUri: `${serverUrl}/realms/${kc.realm}`,
    basepath,
  };
}

/**
 * Where this build's static files (`public/` contents: wizard screenshots, provider logos)
 * are served from.
 *
 * Wizard definitions reference images with root-relative paths like `/wizards/x.png`, which
 * only resolve at the server root. In production the app is mounted several segments deep
 * and under a per-version directory, so the theme template passes the location down as a
 * meta tag rather than the app having to guess it from chunk URLs.
 */
let assetBase: string | undefined;

export function getAssetBase(): string {
  if (assetBase !== undefined) return assetBase;
  const declared = document
    .querySelector('meta[name="wizard-asset-base"]')
    ?.getAttribute("content");
  // `vite dev` serves public/ from the root and emits no meta tag.
  assetBase = declared
    ? new URL(declared, document.baseURI).pathname.replace(/\/*$/, "/")
    : "/";
  return assetBase;
}

/** Resolves a root-relative static asset path against {@link getAssetBase}. */
export function assetUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  return getAssetBase() + path.slice(1);
}

let cached: RuntimeConfig | undefined;

/** Resolves the runtime config once. Must settle before the app renders. */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  cached ??= await resolveRuntimeConfig();
  return cached;
}

/** Synchronous accessor, valid only after {@link loadRuntimeConfig} has resolved. */
export function getRuntimeConfig(): RuntimeConfig {
  if (!cached) {
    throw new Error("getRuntimeConfig() called before loadRuntimeConfig() resolved.");
  }
  return cached;
}
