/**
 * Template variable resolver for wizard JSON.
 *
 * Replaces {{variable.path}} tokens in strings using values from a flat
 * context object. Supports nested dot-notation paths.
 *
 * Examples:
 *   resolve("{{api.entityId}}", { "api.entityId": "https://kc/realms/r" })
 *   → "https://kc/realms/r"
 *
 *   resolve("{{alias}}", { alias: "generic-saml-a1b2c3" })
 *   → "generic-saml-a1b2c3"
 */
export function resolveTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    const value = context[trimmed];
    if (value === undefined || value === null) return "";
    if (typeof value === "function") return String(value());
    return String(value);
  });
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
  const { alias, api, state, formValues = {}, foreachItem = {} } = params;

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
  for (const [k, v] of Object.entries(foreachItem)) {
    ctx[`item.${k}`] = v;
  }

  return ctx;
}
