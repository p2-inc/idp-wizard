/**
 * Template variable resolver for wizard JSON.
 *
 * Replaces {{variable.path}} tokens in strings using values from a flat
 * context object. Supports nested dot-notation paths.
 *
 * Two modes:
 *   resolveTemplate() — always returns a string (for display in UI)
 *   resolveValue()    — returns the raw value when the template is a single
 *                        {{token}} (for action body resolution where objects
 *                        and arrays must pass through)
 */

/**
 * Look up a dot-path in a flat context object.
 *
 * Tries exact match first (`ctx["state.metadata"]`), then progressively
 * shorter prefixes with nested property access:
 *   "state.formValues.clientId"
 *    → ctx["state.formValues.clientId"]  (exact, miss)
 *    → ctx["state.formValues"].clientId  (hit)
 */
function lookupValue(key: string, ctx: Record<string, unknown>): unknown {
  // Exact match
  if (key in ctx) return ctx[key];

  // Progressive prefix match — try longest prefix first
  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join(".");
    if (prefix in ctx) {
      let current: unknown = ctx[prefix];
      for (let j = i; j < parts.length; j++) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[parts[j]];
      }
      return current;
    }
  }

  return undefined;
}

/**
 * String-only resolution. All {{tokens}} are replaced with their string
 * representation. Use this for UI display (copy blocks, labels, etc.).
 */
export function resolveTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    const value = lookupValue(trimmed, context);
    if (value === undefined || value === null) return "";
    if (typeof value === "function") return String(value());
    return String(value);
  });
}

/**
 * Value-preserving resolution. When the entire template is a single {{token}},
 * returns the raw context value (object, array, number, etc.). When the
 * template contains mixed text + tokens, returns a resolved string.
 *
 * Use this for action body resolution where objects must pass through.
 */
export function resolveValue(
  template: string,
  context: Record<string, unknown>,
): unknown {
  const trimmed = template.trim();

  // Single token: {{key}} with nothing else → return raw value
  const singleMatch = trimmed.match(/^\{\{([^}]+)\}\}$/);
  if (singleMatch) {
    const key = singleMatch[1].trim();
    const value = lookupValue(key, context);
    if (value === undefined || value === null) return "";
    if (typeof value === "function") return value();
    return value;
  }

  // Mixed content: resolve as string
  return resolveTemplate(template, context);
}

/**
 * Builds the standard template context from the wizard runtime state.
 * The runner calls this before rendering blocks or executing actions.
 */
export function buildTemplateContext(params: {
  alias: string;
  api: {
    entityId: string;
    ssoUrl: (alias: string) => string;
    samlMetadata: string;
    adminLinkSaml: (alias: string) => string;
    adminLinkOidc: (alias: string) => string;
  };
  state: {
    metadata: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  formValues?: Record<string, unknown>;
  foreachItem?: Record<string, unknown>;
}): Record<string, unknown> {
  const { alias, api, state, formValues = {}, foreachItem } = params;

  const ctx: Record<string, unknown> = {
    alias,
    "api.entityId": api.entityId,
    "api.ssoUrl": api.ssoUrl(alias),
    "api.samlMetadata": api.samlMetadata,
    "api.adminLinkSaml": api.adminLinkSaml(alias),
    "api.adminLinkOidc": api.adminLinkOidc(alias),
    "state.metadata": state.metadata,
  };

  // Flatten state entries as "state.*"
  for (const [k, v] of Object.entries(state)) {
    ctx[`state.${k}`] = v;
  }

  // Flatten form values as "form.*"
  for (const [k, v] of Object.entries(formValues)) {
    ctx[`form.${k}`] = v;
  }

  // Flatten foreach item as "item.*"
  if (foreachItem) {
    for (const [k, v] of Object.entries(foreachItem)) {
      ctx[`item.${k}`] = v;
    }
  }

  return ctx;
}
