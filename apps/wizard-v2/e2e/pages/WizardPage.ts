import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page object model for wizard runner and protocol picker views.
 *
 * Covers:
 * - Protocol picker (multi-protocol providers)
 * - Wizard runner — step navigation, form interactions, confirmation
 */
export class WizardPage {
  readonly page: Page;
  readonly homeLink: Locator;

  // Step navigation
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly stepIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.homeLink = page.getByRole("link", { name: "Providers" });
    this.nextButton = page.getByRole("button", { name: /continue/i });
    this.backButton = page.getByRole("button", { name: /back/i });
    this.stepIndicator = page.locator("[data-step-indicator]");
  }

  async goHome() {
    await this.homeLink.click();
  }

  /** Returns the current URL pathname. */
  pathname() {
    return new URL(this.page.url()).pathname;
  }

  // ── Protocol picker ─────────────────────────────────────────────────────

  /** Select a protocol from the protocol picker page. */
  async selectProtocol(protocol: "saml" | "oidc" | "ldap") {
    await this.page.getByRole("button", { name: new RegExp(protocol, "i") }).click();
  }

  // ── Step navigation ──────────────────────────────────────────────────────

  async clickNext() {
    await this.nextButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  /** Wait for the wizard to display a specific step (by step title text). */
  async waitForStep(titleText: string | RegExp) {
    await expect(
      this.page.getByRole("heading", { name: titleText })
    ).toBeVisible({ timeout: 5_000 });
  }

  // ── Copy blocks ──────────────────────────────────────────────────────────

  /** Returns the visible text of a copy block by its label. */
  async getCopyBlockValue(label: string): Promise<string> {
    const block = this.page.locator(`[data-copy-label="${label}"]`);
    return (await block.textContent()) ?? "";
  }

  // ── Forms ────────────────────────────────────────────────────────────────

  async fillTextField(fieldLabel: string | RegExp, value: string) {
    await this.page.getByLabel(fieldLabel).fill(value);
  }

  async uploadFile(_fieldLabel: string | RegExp, filePath: string) {
    await this.page.locator('input[type="file"]').setInputFiles(filePath);
  }

  /** Click the submit button inside a form by its label text. */
  async submitForm(buttonLabel: string | RegExp) {
    await this.page.getByRole("button", { name: buttonLabel }).click();
  }

  // ── Confirmation step ────────────────────────────────────────────────────

  /** Click the final "Create …" action button on the confirmation step. */
  async confirm(buttonLabel: string | RegExp = /create/i) {
    await this.page.getByRole("button", { name: buttonLabel }).click();
  }

  /** Wait for the success message after IDP/federation creation. */
  async waitForSuccess(messagePattern?: string | RegExp) {
    const pattern = messagePattern ?? /created successfully/i;
    await expect(this.page.getByText(pattern)).toBeVisible({ timeout: 10_000 });
  }

  /** Wait for an error message to appear. */
  async waitForError(messagePattern?: string | RegExp) {
    const pattern = messagePattern ?? /error/i;
    await expect(this.page.getByText(pattern)).toBeVisible({ timeout: 5_000 });
  }
}
