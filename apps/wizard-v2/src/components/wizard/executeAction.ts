/**
 * Action executor for wizard JSON actions.
 *
 * Reads an action definition from the wizard JSON, resolves template variables,
 * makes the appropriate API call via the typed openapi-fetch clients, then
 * dispatches reducer actions and chains follow-up actions.
 *
 * This module is intentionally kept as a pure function (no React hooks) so it
 * can be called from event handlers and tested in isolation.
 *
 * TODO: implement this once the wizard runner renders its first real step.
 * The stubs below define the interface and document the expected behavior.
 */
import type { WizardAction as JsonAction, HttpAction } from "./types";
import type { WizardAction as ReducerAction, WizardState } from "@/context/WizardContext";
import type { OrgsClient, AdminClient } from "@/api/clients";
import { resolveTemplate, buildTemplateContext } from "./resolveTemplate";
import { clearAlias } from "@/lib/alias";

export interface ExecuteActionParams {
  /** Key of the action in the wizard JSON `actions` dictionary */
  actionKey: string;
  /** The action definition from the wizard JSON */
  action: JsonAction;
  /** All actions in this wizard (needed for `then` chaining) */
  allActions: Record<string, JsonAction>;
  /** Current wizard reducer state */
  state: WizardState;
  /** Dispatch to the wizard reducer */
  dispatch: React.Dispatch<ReducerAction>;
  /** API clients — which one is used depends on apiMode */
  orgsClient: OrgsClient;
  adminClient: AdminClient;
  apiMode: "cloud" | "onprem";
  realm: string;
  orgId: string | null;
  api: {
    entityId: string;
    ssoUrl: (alias: string) => string;
    samlMetadata: string;
    adminLinkSaml: (alias: string) => string;
    adminLinkOidc: (alias: string) => string;
    endpoints: {
      importConfig: string;
      createIdp: string;
      addMappers: (alias: string) => string;
    };
  };
  /** Form field values at the time of submission */
  formValues?: Record<string, unknown>;
  /** sessionStorage key for alias cleanup */
  aliasSessionKey: string;
}

export interface ExecuteActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Resolves all string values in a body template object.
 * Called by the HTTP action executor once implemented.
 */
export function resolveBody(
  body: Record<string, unknown>,
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") {
      resolved[k] = resolveTemplate(v, ctx);
    } else if (v !== null && typeof v === "object") {
      resolved[k] = resolveBody(v as Record<string, unknown>, ctx);
    } else {
      resolved[k] = v;
    }
  }
  return resolved;
}

/**
 * Executes a single wizard action.
 *
 * Handles:
 * - clearAlias — removes the alias from sessionStorage
 * - HTTP actions — calls the appropriate API endpoint, merges metadata,
 *   dispatches reducer actions, chains `then` actions
 * - foreach — repeats an HTTP action for each item in the array
 */
export async function executeAction(
  params: ExecuteActionParams,
): Promise<ExecuteActionResult> {
  const { action, state, dispatch, aliasSessionKey, allActions } = params;

  // --- clearAlias ---
  if ("type" in action && action.type === "clearAlias") {
    clearAlias(aliasSessionKey);
    return { ok: true };
  }

  const httpAction = action as HttpAction;
  const ctx = buildTemplateContext({
    alias: state.alias,
    api: params.api,
    state,
    formValues: params.formValues,
  });

  // TODO: implement HTTP action execution
  // Steps:
  //   1. Resolve httpAction.endpoint → actual URL from params.api.endpoints
  //   2. If httpAction.foreach is set, iterate and call for each item
  //   3. For each call: resolve body template, build FormData if multipart
  //   4. Call orgsClient or adminClient depending on apiMode + endpoint type
  //   5. On success:
  //      a. If onSuccess.mergeIntoMetadata → dispatch SET_METADATA with merged data
  //      b. If onSuccess.dispatch → fire each listed reducer action
  //      c. If onSuccess.then → call executeAction for each chained action key
  //   6. On error: dispatch SUBMIT_ERROR with messages.error
  //   7. Return { ok: true/false, message }

  console.warn("executeAction: HTTP action execution not yet implemented", {
    action: httpAction,
    ctx,
  });

  void dispatch; // suppress unused warning until implemented
  void allActions;

  return {
    ok: false,
    message: "Action execution not yet implemented.",
  };
}
