/**
 * saml-capture.ts
 *
 * Walks through the AWS IAM Identity Center SAML setup described in saml.json,
 * taking screenshots at each step. The resulting images can be dropped into the
 * wizard's asset folder to keep the UI screenshots up-to-date.
 *
 * Screenshots are saved to:  wizards/aws/playwright/screenshots/
 *
 * Usage:
 *   cd apps/wizard-v2
 *   pnpm capture:aws:saml
 *
 * Optional environment variables:
 *   AWS_SSO_START_URL   Your SSO portal, e.g. https://your-org.awsapps.com/start/#/?tab=accounts
 *                       Will prompt at runtime if not set.
 *   AWS_CONSOLE_URL     Base console URL (default: https://console.aws.amazon.com)
 *
 *   SP_ACS_URL          Your Keycloak ACS URL        (will prompt if not set)
 *   SP_ENTITY_ID        Your Keycloak Entity ID       (will prompt if not set)
 *   APP_DISPLAY_NAME    Display name for the new AWS app (will prompt if not set)
 */

import { chromium } from "@playwright/test";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { AwsPage } from "./AwsPage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function resolveInputs(): Promise<{
  startUrl: string;
  displayName: string;
  acsUrl: string;
  entityId: string;
}> {
  const startUrl =
    process.env["AWS_SSO_START_URL"] ||
    (await ask("AWS SSO start URL (e.g. https://your-org.awsapps.com/start/#/?tab=accounts): "));

  const displayName =
    process.env["APP_DISPLAY_NAME"] ||
    (await ask("Application display name: "));

  const acsUrl =
    process.env["SP_ACS_URL"] ||
    (await ask("ACS URL (from your IdP console): "));

  const entityId =
    process.env["SP_ENTITY_ID"] ||
    (await ask("Entity ID (from your IdP console): "));

  return { startUrl, displayName, acsUrl, entityId };
}

async function main() {
  console.log("\n=== AWS IAM Identity Center SAML Capture ===");
  console.log(`Screenshots will be saved to: ${SCREENSHOTS_DIR}\n`);

  const { startUrl, ...spDetails } = await resolveInputs();

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null, // use maximized window size
    recordVideo: undefined,
  });

  const page = await context.newPage();
  const aws = new AwsPage(page, SCREENSHOTS_DIR);

  try {
    // ── Step 1: Log in ──────────────────────────────────────────────────────
    console.log("\n[Step 1] Opening AWS console for login...");
    await aws.login(startUrl);

    // ── Step 2: Navigate to Identity Center → Applications ──────────────────
    console.log("\n[Step 2] Navigating to IAM Identity Center...");
    await aws.goToIdentityCenter();
    await aws.goToApplications();

    // ── Step 3: Create a new custom SAML 2.0 application ───────────────────
    console.log("\n[Step 3] Starting 'Add application' flow...");
    await aws.startAddSamlApplication();

    // ── Step 4: Configure metadata ──────────────────────────────────────────
    console.log("\n[Step 4] Configuring application metadata...");
    const idpMetadataUrl = await aws.configureMetadata(spDetails);

    if (idpMetadataUrl) {
      console.log(`\n  IdP SAML Metadata URL (copy this into the wizard):`);
      console.log(`  ${idpMetadataUrl}\n`);
    }

    await aws.submitApplication();

    // ── Step 5: Attribute mapping ───────────────────────────────────────────
    console.log("\n[Step 5] Configuring attribute mappings...");
    await aws.configureAttributeMapping();
    await aws.submitApplication();

    // ── Step 6: User access ─────────────────────────────────────────────────
    console.log("\n[Step 6] Configuring user access...");
    await aws.configureUserAccess();

    console.log("\n✓ Capture complete.");
    console.log(`  Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log(
      "  You can now copy the relevant screenshots into public/wizards/aws/ to update the wizard images."
    );
  } catch (err) {
    console.error("\n✗ Capture failed:", err);
    await aws.screenshot("error-state");
    process.exitCode = 1;
  } finally {
    await aws.waitForUser("Review the final browser state, then close.");
    await browser.close();
  }
}

main();
