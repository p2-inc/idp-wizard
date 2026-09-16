import { test as setup, expect } from "@playwright/test";
import path from "path";

/**
 * Authentication setup for integration tests.
 *
 * Navigates to the app, follows the OIDC redirect to Keycloak, logs in as the
 * realm-admin wizard user, then saves the storage state (cookies + localStorage
 * + sessionStorage) so that integration test projects can reuse the session
 * without re-authenticating on every test.
 *
 * Run as part of the `auth:setup` Playwright project (see playwright.config.ts).
 * Only executed when PLAYWRIGHT_INTEGRATION=true.
 *
 * Prerequisites:
 *   cd docker && docker compose up -d
 *   Wait for Keycloak to be healthy at http://localhost:8080/auth/realms/wizard
 */

const AUTH_STATE_PATH = path.join("e2e", ".auth", "admin.json");

setup("authenticate as realm admin", async ({ page }) => {
  // Navigate to the app — oidc-spa withAutoLogin() will redirect to Keycloak
  await page.goto("/");

  // Wait for Keycloak login page
  await page.waitForURL(/localhost:8080/, { timeout: 15_000 });

  await expect(
    page.locator("input[name='username'], #username"),
    "Keycloak login page should be visible"
  ).toBeVisible({ timeout: 10_000 });

  await page.locator("input[name='username'], #username").fill("wizard");
  await page.locator("input[name='password'], #password").fill("password");
  await page.locator("[type='submit'], #kc-login").click();

  // Wait for redirect back to the app
  await page.waitForURL("http://localhost:5173/**", { timeout: 15_000 });

  // Brief pause so oidc-spa can finish the token exchange and write to storage
  await page.waitForTimeout(1_000);

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
