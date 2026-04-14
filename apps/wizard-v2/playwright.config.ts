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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !isIntegration,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",

  globalSetup: isIntegration ? "./e2e/global-setup.ts" : undefined,

  use: {
    baseURL: "http://localhost:5173",
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
      ? `VITE_OIDC_ISSUER_URI=${ISSUER_URI} VITE_OIDC_CLIENT_ID=wizard-v2-dev pnpm dev`
      : `VITE_OIDC_USE_MOCK=true VITE_OIDC_ISSUER_URI=${ISSUER_URI} pnpm dev`,
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
