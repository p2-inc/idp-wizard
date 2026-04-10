/**
 * Action executor for wizard JSON actions.
 *
 * Reads an action definition from the wizard JSON, resolves template variables,
 * makes the appropriate API call via fetchWithAuth, then dispatches reducer
 * actions and chains follow-up actions.
 *
 * Feature-flag middleware is applied automatically:
 *   - trustEmail    → injects trustEmail:true into createIdp body
 *   - emailAsUsername → adds idpUsername mapper, remaps username to email attr
 *   - usernameMapperImport → sets username mapper syncMode to IMPORT
 */
import type {
  WizardAction as JsonAction,
  HttpAction,
  SaveFormAction,
  EndpointSlot,
} from "./types";
import type {
  WizardAction as ReducerAction,
  WizardState,
  WizardEndpoints,
} from "@/context/WizardContext";
import { wizardReducer } from "@/context/WizardContext";
import type { OrgsClient, AdminClient } from "@/api/clients";
import type { WizardConfig } from "@/hooks/useWizardConfig";
import { resolveValue, buildTemplateContext } from "./resolveTemplate";
import { clearAlias } from "@/lib/alias";
import { fetchWithAuth } from "@/oidc";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ExecuteActionParams {
  actionKey: string;
  action: JsonAction;
  allActions: Record<string, JsonAction>;
  state: WizardState;
  dispatch: React.Dispatch<ReducerAction>;
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
    endpoints: WizardEndpoints;
  };
  formValues?: Record<string, unknown>;
  aliasSessionKey: string;
  config: WizardConfig;
}

export interface ExecuteActionResult {
  ok: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Body resolution
// ---------------------------------------------------------------------------

/**
 * Resolves all template values in a body object.
 *
 * Supports:
 *   - String values: "{{token}}" → raw value or interpolated string
 *   - Nested objects: recursed
 *   - Arrays: each element resolved
 *   - "$spread" key: resolved value is spread into the parent object
 *     (explicit keys take precedence over spread keys)
 */
export function resolveBody(
  body: Record<string, unknown>,
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  let spreadObj: Record<string, unknown> | null = null;

  for (const [k, v] of Object.entries(body)) {
    if (k === "$spread") {
      if (typeof v === "string") {
        const val = resolveValue(v, ctx);
        if (val && typeof val === "object" && !Array.isArray(val)) {
          spreadObj = val as Record<string, unknown>;
        }
      }
      continue;
    }

    if (typeof v === "string") {
      resolved[k] = resolveValue(v, ctx);
    } else if (Array.isArray(v)) {
      resolved[k] = v.map((item) => {
        if (typeof item === "string") return resolveValue(item, ctx);
        if (item && typeof item === "object")
          return resolveBody(item as Record<string, unknown>, ctx);
        return item;
      });
    } else if (v !== null && typeof v === "object") {
      resolved[k] = resolveBody(v as Record<string, unknown>, ctx);
    } else {
      resolved[k] = v;
    }
  }

  return spreadObj ? { ...spreadObj, ...resolved } : resolved;
}

// ---------------------------------------------------------------------------
// Endpoint resolution
// ---------------------------------------------------------------------------

function resolveEndpoint(
  name: EndpointSlot,
  endpoints: WizardEndpoints,
  state: WizardState,
): string {
  switch (name) {
    case "importConfig":
      return endpoints.importConfig;
    case "createIdp":
      return endpoints.createIdp;
    case "addMappers":
      return endpoints.addMappers(state.alias);
    case "testLdapConnection":
      return endpoints.testLdapConnection;
    case "createComponent":
      return endpoints.createComponent;
    case "triggerSync": {
      const id = (state.metadata?.id as string) ?? "";
      return endpoints.triggerSync(id);
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Feature-flag middleware
// ---------------------------------------------------------------------------

/** Adds trustEmail to createIdp body when the realm flag is set. */
function applyTrustEmail(
  body: Record<string, unknown>,
  config: WizardConfig,
): Record<string, unknown> {
  if (!config.trustEmail) return body;
  return { ...body, trustEmail: true };
}

/**
 * When emailAsUsername is enabled:
 *   1. Adds an idpUsername mapper that preserves the original username mapping
 *   2. Remaps the "username" mapper to use the email attribute instead
 */
function applyEmailAsUsername(
  items: Record<string, unknown>[],
  config: WizardConfig,
): Record<string, unknown>[] {
  if (!config.emailAsUsername) return items;

  const userIdx = items.findIndex((m) => m.userAttribute === "username");
  const emailIdx = items.findIndex((m) => m.userAttribute === "email");
  if (userIdx < 0 || emailIdx < 0) return items;

  const originalUsername = items[userIdx];
  const emailItem = items[emailIdx];

  const idpUsername = { ...originalUsername, userAttribute: "idpUsername" };

  const modified = [...items];
  modified[userIdx] = {
    ...originalUsername,
    attributeName: emailItem.attributeName,
    friendlyName: emailItem.friendlyName,
  };

  return [idpUsername, ...modified];
}

/**
 * When usernameMapperImport is enabled, the username mapper's syncMode
 * is changed from INHERIT to IMPORT so the username is only written on
 * first login.
 */
function applyUsernameMapperImport(
  resolvedBody: Record<string, unknown>,
  item: Record<string, unknown>,
  config: WizardConfig,
): Record<string, unknown> {
  if (!config.usernameMapperImport) return resolvedBody;
  if (item.userAttribute !== "username") return resolvedBody;

  const bodyConfig = resolvedBody.config as Record<string, unknown> | undefined;
  if (bodyConfig) {
    return {
      ...resolvedBody,
      config: { ...bodyConfig, syncMode: "IMPORT" },
    };
  }
  return resolvedBody;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function execHttp(
  url: string,
  method: string,
  contentType: "json" | "multipart",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const options: RequestInit = { method };

  if (contentType === "multipart") {
    const formData = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v instanceof File) {
        formData.append(k, v);
      } else if (v != null) {
        formData.append(k, String(v));
      }
    }
    options.body = formData;
    // Don't set Content-Type — browser sets it with the boundary
  } else {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const response = await fetchWithAuth(url, options);

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: response.ok, status: response.status, data };
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

export async function executeAction(
  params: ExecuteActionParams,
): Promise<ExecuteActionResult> {
  const {
    action,
    state: initialState,
    dispatch,
    aliasSessionKey,
    allActions,
    config,
    formValues,
  } = params;

  // Local state copy — tracks dispatched changes so chained actions see them.
  // We apply reducer updates locally AND dispatch to React so the UI stays in
  // sync while the executor continues its work.
  let currentState = { ...initialState };

  function localDispatch(a: ReducerAction) {
    dispatch(a);
    currentState = wizardReducer(currentState, a);
  }

  // Persist current form values into state so subsequent actions can reference
  // them via {{state.formValues.fieldName}}
  if (formValues && Object.keys(formValues).length > 0) {
    localDispatch({ type: "SAVE_FORM_VALUES", values: formValues });
  }

  // --- clearAlias --------------------------------------------------------
  if ("type" in action && action.type === "clearAlias") {
    clearAlias(aliasSessionKey);
    return { ok: true };
  }

  // --- saveForm ----------------------------------------------------------
  if ("type" in action && action.type === "saveForm") {
    const saveAction = action as SaveFormAction;

    if (saveAction.dispatch) {
      for (const d of saveAction.dispatch) {
        localDispatch({ type: d } as ReducerAction);
      }
    }

    return { ok: true };
  }

  // --- HTTP action -------------------------------------------------------
  const httpAction = action as HttpAction;

  try {
    const url = resolveEndpoint(
      httpAction.endpoint,
      params.api.endpoints,
      currentState,
    );

    if (!url) {
      localDispatch({
        type: "SUBMIT_ERROR",
        error: `Unknown endpoint: ${httpAction.endpoint}`,
      });
      return { ok: false, message: `Unknown endpoint: ${httpAction.endpoint}` };
    }

    // Build the foreach item list. When there's no foreach, we execute once
    // with an empty item context.
    let foreachItems: Record<string, unknown>[] = httpAction.foreach
      ? httpAction.foreach.map((item) => ({ ...item }))
      : [{}];

    // Feature flag: emailAsUsername — modify mapper list before iteration
    if (httpAction.foreach && httpAction.endpoint === "addMappers") {
      foreachItems = applyEmailAsUsername(foreachItems, config);
    }

    let lastResponse: unknown = null;

    for (const item of foreachItems) {
      // Build template context for this iteration
      const ctx = buildTemplateContext({
        alias: currentState.alias,
        api: params.api,
        state: currentState,
        formValues: currentState.formValues,
        foreachItem: httpAction.foreach ? item : undefined,
      });

      let resolvedBody = resolveBody(httpAction.body, ctx);

      // Feature flag: trustEmail on createIdp
      if (httpAction.endpoint === "createIdp") {
        resolvedBody = applyTrustEmail(resolvedBody, config);
      }

      // Feature flag: usernameMapperImport on mapper creation
      if (httpAction.foreach && httpAction.endpoint === "addMappers") {
        resolvedBody = applyUsernameMapperImport(resolvedBody, item, config);
      }

      const result = await execHttp(
        url,
        httpAction.method,
        httpAction.contentType,
        resolvedBody,
      );

      if (!result.ok) {
        const errorMsg =
          httpAction.messages?.error ?? `Action failed (HTTP ${result.status})`;
        localDispatch({ type: "SUBMIT_ERROR", error: errorMsg });
        return { ok: false, message: errorMsg };
      }

      lastResponse = result.data;
    }

    // --- onSuccess -------------------------------------------------------
    if (httpAction.onSuccess) {
      const {
        mergeIntoMetadata,
        dispatch: dispatchList,
        then: thenList,
      } = httpAction.onSuccess;

      // Merge response into state.metadata
      if (mergeIntoMetadata && lastResponse && typeof lastResponse === "object") {
        const merged = {
          ...(currentState.metadata ?? {}),
          ...(lastResponse as Record<string, unknown>),
        };
        localDispatch({ type: "SET_METADATA", metadata: merged });
      }

      // Dispatch listed reducer actions
      if (dispatchList) {
        for (const d of dispatchList) {
          if (typeof d === "string") {
            localDispatch({ type: d } as ReducerAction);
          } else if (typeof d === "object" && d !== null && "type" in d) {
            localDispatch(d as unknown as ReducerAction);
          }
        }
      }

      // Chain follow-up actions
      if (thenList) {
        for (const nextKey of thenList) {
          const nextAction = allActions[nextKey];
          if (!nextAction) {
            console.warn(`executeAction: unknown chained action "${nextKey}"`);
            continue;
          }

          const chainResult = await executeAction({
            ...params,
            actionKey: nextKey,
            action: nextAction,
            state: currentState,
            formValues: undefined,
          });

          if (!chainResult.ok) return chainResult;
        }
      }
    }

    const successMsg = httpAction.messages?.success;
    return { ok: true, message: successMsg };
  } catch (err) {
    const errorMsg =
      httpAction.messages?.error ?? "An unexpected error occurred.";
    localDispatch({ type: "SUBMIT_ERROR", error: errorMsg });
    return { ok: false, message: errorMsg };
  }
}
