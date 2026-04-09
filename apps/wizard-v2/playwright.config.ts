import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for wizard-v2 E2E tests.
 *
 * Tests run against the Vite dev server with OIDC in mock mode so no live
 * Keycloak instance is required. For CI or full integration testing, point
 * VITE_OIDC_USE_MOCK=false and supply a running Keycloak via docker compose.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "VITE_OIDC_USE_MOCK=true pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
