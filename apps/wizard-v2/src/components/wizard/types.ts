/**
 * TypeScript types mirroring the wizard JSON schema (schemaVersion: "1.0").
 * Keep in sync with the schema described in AGENTS.md and wizards/**\/\*.json.
 */

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: "text";
  content: string;
}

export interface CopyBlock {
  type: "copy";
  label: string;
  /** Template string, e.g. "{{api.entityId}}" — resolved at render time */
  value: string;
  hint?: string;
}

export interface FormGroupBlock {
  type: "formGroup";
  id: string;
  /** When true, only one form in the group can be validated at a time (renders as tabs) */
  exclusive: boolean;
  /** Keys into the parent wizard's `forms` dictionary */
  forms: string[];
}

export type AttributeRow = Record<string, string>;

export interface AttributeTableBlock {
  type: "attributeTable";
  /**
   * Maps row key → column header label, also determines column order.
   * When omitted, defaults to idpAttribute / keycloakAttribute with generic headers.
   */
  columns?: Record<string, string>;
  rows: AttributeRow[];
}

export interface ConfirmBlock {
  type: "confirm";
  title: string;
  description: string;
  buttonText: string;
  /** Action key from the `actions` dictionary to execute on confirmation */
  action: string;
  /** Template string for the Keycloak admin console link */
  adminLink: string;
  adminButtonText: string;
}

export interface ImageBlock {
  type: "image";
  src: string;
  alt?: string;
  caption?: string;
  /** When true, skip the default inline max-width cap. */
  fullWidth?: boolean;
}

/**
 * Displays a server-generated secret that the user must copy now — typically
 * a SCIM Bearer token or Basic auth password the wizard just provisioned.
 * Rendered with a destructive-color container, a copy button, and a warning
 * that the value will not be shown again after leaving the step.
 */
export interface SecretRevealBlock {
  type: "secretReveal";
  label: string;
  /** Template string, usually "{{state.metadata.auth.shared_secret}}" */
  value: string;
  /** One-line warning displayed above the value in a destructive color */
  warning: string;
  hint?: string;
}

export type WizardBlock =
  | TextBlock
  | CopyBlock
  | FormGroupBlock
  | AttributeTableBlock
  | ConfirmBlock
  | ImageBlock
  | SecretRevealBlock;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export interface WizardStep {
  id: number;
  title: string;
  /** Omit for normal steps. "confirm" for the final creation step. */
  type?: "confirm";
  /** Expression evaluated against WizardState; if false, Next is disabled */
  enableNextWhen?: string;
  blocks: WizardBlock[];
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export type FieldType = "text" | "url" | "file" | "password" | "textarea";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  /** For file inputs — MIME types or extensions, e.g. "text/xml,.xml" */
  accept?: string;
}

export interface FormSubmit {
  label: string;
  /** Action key from the `actions` dictionary */
  action: string;
}

export interface WizardForm {
  title: string;
  description: string;
  fields: FormField[];
  submit: FormSubmit;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ContentType = "json" | "multipart";

export type EndpointSlot =
  | "importConfig"
  | "createIdp"
  | "addMappers"
  | "testLdapConnection"
  | "createComponent"
  | "triggerSync"
  /** GET /{realm}/orgs/config — reads scimEnabled for the realm gate */
  | "getOrgConfig"
  /** PUT /{realm}/orgs/{orgId}/scim — configures inbound SCIM provisioning */
  | "setOrgScim";

export interface ActionOnSuccess {
  /** Merge the entire response body into state.metadata */
  mergeIntoMetadata?: string;
  /** Reducer action type strings to dispatch, or objects with payload */
  dispatch?: (string | Record<string, unknown>)[];
  /** Follow-up action keys to execute sequentially after this action succeeds */
  then?: string[];
}

export interface HttpAction {
  endpoint: EndpointSlot;
  method: "POST" | "PUT" | "GET" | "DELETE";
  contentType: ContentType;
  /** Body template — values like "{{form.url}}" are resolved at call time */
  body: Record<string, unknown>;
  /** When set, the action is called once per item in the array */
  foreach?: Record<string, unknown>[];
  onSuccess?: ActionOnSuccess;
  messages?: {
    success?: string;
    error?: string;
  };
}

export interface ClearAliasAction {
  type: "clearAlias";
}

/** Saves current form values into wizard state fields without an API call */
export interface SaveFormAction {
  type: "saveForm";
  dispatch?: string[];
  fields: string[];
}

/**
 * Generates a cryptographically random secret client-side and saves it to
 * state.formValues under the given field id. Used by SCIM wizards to provision
 * Bearer tokens or Basic auth passwords without depending on backend echo.
 *
 * The optional `then` chain runs the listed action keys after the secret is
 * persisted to formValues — typically pointing at the HTTP action that writes
 * the new credential to the backend.
 */
export interface GenerateSecretAction {
  type: "generateSecret";
  /** Form field id to fill with the generated value (e.g. "shared_secret") */
  fieldId: string;
  /** Random bytes (default 32 = ~43 base64url chars) */
  bytes?: number;
  /** Follow-up action keys to execute sequentially after generation */
  then?: string[];
}

export type WizardAction =
  | HttpAction
  | ClearAliasAction
  | SaveFormAction
  | GenerateSecretAction;

// ---------------------------------------------------------------------------
// IDP config defaults
// ---------------------------------------------------------------------------

export interface IdpConfig {
  providerId: string;
  hideOnLogin: boolean;
  defaults?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Alias
// ---------------------------------------------------------------------------

export interface AliasConfig {
  /** Prefix for the generated alias: "{prefix}-{6chars}" */
  prefix: string;
  /** sessionStorage key — unique per provider+protocol */
  sessionKey: string;
}

// ---------------------------------------------------------------------------
// Top-level wizard definition
// ---------------------------------------------------------------------------

export interface WizardDefinition {
  schemaVersion: "1.0";
  id: string;
  providerId: string;
  protocol: string;
  title: string;
  alias: AliasConfig;
  idpConfig: IdpConfig;
  steps: WizardStep[];
  forms: Record<string, WizardForm>;
  actions: Record<string, WizardAction>;
}
