import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for wizard-v2 E2E tests.
 *
 * TWO MODES:
 *
 * Default (mock):
 *   pnpm test:e2e
 *   Runs against Vite with OIDC in mock mode — no Keycloak required.
 *   Covers: provider-selector smoke tests, wizard-completion flow tests (API mocked via page.route).
 *
 * Integration (real Keycloak):
 *   PLAYWRIGHT_INTEGRATION=true pnpm test:e2e
 *   Requires: `cd docker && docker compose up -d` before running.
 *   Runs auth:setup first (browser OIDC login → saves storageState).
 *   Then runs global-setup.ts (creates test organizations via Phase Two API).
 *   Covers: organization management tests + all mock tests with real auth.
 */

const isIntegration = !!process.env.PLAYWRIGHT_INTEGRATION;

const KC_BASE = process.env.KC_BASE_URL ?? "http://localhost:8080/auth";
const ISSUER_URI = `${KC_BASE}/realms/wizard`;

// Port for the Vite dev server under test. Several worktrees may run this
// suite at once on one machine, so mock mode does not use the shared default
// 5173: it derives a stable port (20000-29999) from the checkout path, so each
// worktree gets its own port and reuses only its own server. Integration mode
// stays on 5173 because the Keycloak realm's redirect URI and CORS origin are
// pinned to it. E2E_PORT overrides both.
const PORT =
  Number(process.env.E2E_PORT) ||
  (isIntegration
    ? 5173
    : 20000 +
      (parseInt(createHash("sha1").update(process.cwd()).digest("hex").slice(0, 8), 16) % 10000));
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !isIntegration,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",

  globalSetup: isIntegration ? "./e2e/global-setup.ts" : undefined,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // ── Auth setup (integration only) ─────────────────────────────────────
    ...(isIntegration
      ? [
          {
            name: "auth:setup",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),

    // ── Mock tests (always run) ────────────────────────────────────────────
    // provider-selector smoke tests + wizard-completion tests (API mocked)
    {
      name: "chromium",
      testIgnore: isIntegration
        ? [/auth\.setup\.ts/]
        : [/auth\.setup\.ts/, /organizations\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        ...(isIntegration
          ? { storageState: "e2e/.auth/admin.json" }
          : {}),
      },
      dependencies: isIntegration ? ["auth:setup"] : [],
    },
  ],

  webServer: {
    // Always pass ISSUER_URI so wizard runner resolves API URLs correctly,
    // even in mock mode where the API calls are intercepted by page.route().
    command: isIntegration
      ? `VITE_OIDC_ISSUER_URI=${ISSUER_URI} VITE_OIDC_CLIENT_ID=wizard-v2-dev pnpm dev --port ${PORT} --strictPort`
      : `VITE_OIDC_USE_MOCK=true VITE_OIDC_ISSUER_URI=${ISSUER_URI} pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
