/**
 * Persists wizard progress in sessionStorage so a page refresh resumes at the
 * same step with the non-secret inputs and validation state restored.
 *
 * Like the alias (see alias.ts), the snapshot is scoped to the tab and to one
 * provider+protocol. It is rewritten on every state change, and removed when
 * the wizard completes or the user leaves it.
 *
 * Secrets never reach storage. A value is treated as secret when it comes from
 * a `password` field, is produced by a `generateSecret` action, is derived
 * from either through a `saveForm` `set` template, or sits under a key that
 * looks like a credential. Because a step that collected a secret cannot be
 * resumed without it, the snapshot also forgets that the step was completed
 * and resumes there at the latest; the user re-enters the secret and carries
 * on with everything else intact.
 */
import type { WizardState } from "@/context/WizardContext";
import type {
  WizardAction,
  WizardDefinition,
} from "@/components/wizard/types";

const SNAPSHOT_VERSION = 1;

/** Reducer action type → the WizardState flag it sets. */
const FLAG_BY_ACTION = {
  METADATA_VALIDATED: "metadataValidated",
  CREDENTIALS_PROVIDED: "credentialsProvided",
  CONNECTION_TESTED: "connectionTested",
  AUTH_TESTED: "authTested",
  TARGET_APP_CONFIGURED: "targetAppConfigured",
} as const;

type FlagKey = (typeof FLAG_BY_ACTION)[keyof typeof FLAG_BY_ACTION];

/**
 * Keys that hold credentials regardless of how the field is declared. Kept
 * narrow on purpose: OIDC metadata has non-secret keys such as `tokenUrl`.
 */
const SECRET_KEY_PATTERN = /secret|password|credential/i;

/** The part of WizardState that survives a refresh. */
export type RestoredWizardState = Pick<
  WizardState,
  | "displayName"
  | "currentStep"
  | "stepIdReached"
  | "metadata"
  | "formValues"
  | "succeededForms"
  | FlagKey
>;

interface StoredSnapshot extends RestoredWizardState {
  v: number;
  /** Organization the progress belongs to; null for realm-wide. */
  orgId: string | null;
}

export function wizardSessionKey(aliasSessionKey: string): string {
  return `${aliasSessionKey}:state`;
}

// ---------------------------------------------------------------------------
// Secret detection
// ---------------------------------------------------------------------------

/** Form value keys that must never be written to storage. */
export function secretFieldIds(definition: WizardDefinition): Set<string> {
  const ids = new Set<string>();

  for (const form of Object.values(definition.forms)) {
    for (const field of form.fields) {
      if (field.type === "password") ids.add(field.id);
    }
  }
  for (const action of Object.values(definition.actions)) {
    if ("type" in action && action.type === "generateSecret") {
      ids.add(action.fieldId);
    }
  }

  // Values a saveForm `set` template derives from a secret are secret too.
  // Repeat until stable so a chain of derived values is followed.
  const references = (template: string) =>
    [...ids].some(
      (id) =>
        template.includes(`{{form.${id}}}`) ||
        template.includes(`{{state.formValues.${id}}}`),
    );
  let grew = true;
  while (grew) {
    grew = false;
    for (const action of Object.values(definition.actions)) {
      if (!("type" in action) || action.type !== "saveForm" || !action.set) {
        continue;
      }
      for (const [key, template] of Object.entries(action.set)) {
        if (!ids.has(key) && references(template)) {
          ids.add(key);
          grew = true;
        }
      }
    }
  }

  return ids;
}

/** Walks an action and everything it chains to. */
function walkActionChain(
  actionKey: string,
  actions: Record<string, WizardAction>,
  visit: (action: WizardAction) => void,
  seen = new Set<string>(),
): void {
  if (seen.has(actionKey)) return;
  seen.add(actionKey);
  const action = actions[actionKey];
  if (!action) return;
  visit(action);

  const next =
    "type" in action
      ? action.type === "generateSecret"
        ? action.then
        : undefined
      : action.onSuccess?.then;
  for (const key of next ?? []) walkActionChain(key, actions, visit, seen);
}

/** What submitting a form does, as far as resuming it is concerned. */
function describeFormSubmit(
  formKey: string,
  definition: WizardDefinition,
  secrets: Set<string>,
): { needsSecret: boolean; flags: FlagKey[] } {
  const form = definition.forms[formKey];
  let needsSecret = form.fields.some((f) => secrets.has(f.id));
  const flags: FlagKey[] = [];

  walkActionChain(form.submit.action, definition.actions, (action) => {
    let dispatched: (string | Record<string, unknown>)[] = [];
    if ("type" in action) {
      if (action.type === "generateSecret") needsSecret = true;
      if (action.type === "saveForm") dispatched = action.dispatch ?? [];
    } else {
      dispatched = action.onSuccess?.dispatch ?? [];
    }
    for (const d of dispatched) {
      const type = typeof d === "string" ? d : d.type;
      if (typeof type === "string" && type in FLAG_BY_ACTION) {
        flags.push(FLAG_BY_ACTION[type as keyof typeof FLAG_BY_ACTION]);
      }
    }
  });

  return { needsSecret, flags };
}

/** The step that renders a form, or undefined when no step does. */
function stepOfForm(
  formKey: string,
  definition: WizardDefinition,
): number | undefined {
  return definition.steps.find((step) =>
    step.blocks.some(
      (b) => b.type === "formGroup" && b.forms.includes(formKey),
    ),
  )?.id;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Removes credential-looking keys from an API response, at any depth. */
function scrubSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!SECRET_KEY_PATTERN.test(k)) out[k] = scrubSecrets(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/**
 * Builds the state a refresh would resume with: secrets removed, and any step
 * that depended on one marked as not yet completed.
 */
export function buildWizardSnapshot(
  state: WizardState,
  definition: WizardDefinition,
): RestoredWizardState {
  const secrets = secretFieldIds(definition);

  // Keep serializable, non-secret values. Uploaded File objects cannot be
  // stored; the metadata parsed from them is kept in `metadata` instead.
  const formValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state.formValues)) {
    if (secrets.has(k) || SECRET_KEY_PATTERN.test(k)) continue;
    if (["string", "number", "boolean"].includes(typeof v)) formValues[k] = v;
  }

  const snapshot: RestoredWizardState = {
    displayName: state.displayName,
    currentStep: state.currentStep,
    stepIdReached: state.stepIdReached,
    metadata: state.metadata
      ? (scrubSecrets(state.metadata) as Record<string, unknown>)
      : null,
    metadataValidated: state.metadataValidated,
    credentialsProvided: state.credentialsProvided,
    connectionTested: state.connectionTested,
    authTested: state.authTested,
    targetAppConfigured: state.targetAppConfigured,
    formValues,
    succeededForms: {},
  };

  for (const [formKey, succeeded] of Object.entries(state.succeededForms)) {
    if (!succeeded || !definition.forms[formKey]) continue;
    const { needsSecret, flags } = describeFormSubmit(
      formKey,
      definition,
      secrets,
    );
    if (!needsSecret) {
      snapshot.succeededForms[formKey] = true;
      continue;
    }
    // The secret is gone, so this form has to be submitted again.
    for (const flag of flags) snapshot[flag] = false;
    const step = stepOfForm(formKey, definition);
    if (step !== undefined) {
      snapshot.currentStep = Math.min(snapshot.currentStep, step);
      snapshot.stepIdReached = Math.min(snapshot.stepIdReached, step);
    }
  }

  return snapshot;
}

/** Writes the snapshot. Storage being full or unavailable is not an error. */
export function saveWizardSnapshot(
  aliasSessionKey: string,
  orgId: string | null,
  snapshot: RestoredWizardState,
): void {
  const stored: StoredSnapshot = { v: SNAPSHOT_VERSION, orgId, ...snapshot };
  try {
    sessionStorage.setItem(
      wizardSessionKey(aliasSessionKey),
      JSON.stringify(stored),
    );
  } catch {
    // Progress simply won't survive a refresh.
  }
}

/**
 * Reads the snapshot back. Returns null when there is none, or when it does
 * not belong to this wizard as it is now (other organization, older format,
 * or a step the definition no longer has).
 */
export function loadWizardSnapshot(
  definition: WizardDefinition,
  orgId: string | null,
): RestoredWizardState | null {
  let parsed: unknown;
  try {
    const raw = sessionStorage.getItem(
      wizardSessionKey(definition.alias.sessionKey),
    );
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;
  const s = parsed as Partial<StoredSnapshot>;
  const stepIds = new Set(definition.steps.map((step) => step.id));
  if (
    s.v !== SNAPSHOT_VERSION ||
    (s.orgId ?? null) !== orgId ||
    typeof s.currentStep !== "number" ||
    typeof s.stepIdReached !== "number" ||
    !stepIds.has(s.currentStep) ||
    s.stepIdReached < s.currentStep ||
    !isPlainObject(s.formValues) ||
    !isPlainObject(s.succeededForms)
  ) {
    return null;
  }

  return {
    displayName:
      typeof s.displayName === "string" ? s.displayName : definition.title,
    currentStep: s.currentStep,
    stepIdReached: s.stepIdReached,
    metadata: isPlainObject(s.metadata) ? s.metadata : null,
    metadataValidated: s.metadataValidated === true,
    credentialsProvided: s.credentialsProvided === true,
    connectionTested: s.connectionTested === true,
    authTested: s.authTested === true,
    targetAppConfigured: s.targetAppConfigured === true,
    formValues: s.formValues,
    succeededForms: Object.fromEntries(
      Object.entries(s.succeededForms).filter(([, v]) => v === true),
    ) as Record<string, boolean>,
  };
}

/** Removes the snapshot on wizard completion or when the user leaves. */
export function clearWizardSnapshot(aliasSessionKey: string): void {
  try {
    sessionStorage.removeItem(wizardSessionKey(aliasSessionKey));
  } catch {
    // Nothing to clear.
  }
}
