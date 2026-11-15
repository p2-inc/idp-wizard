/**
 * Evaluator for a step's `enableNextWhen` expression.
 *
 * An expression is a dotted path into the wizard state, e.g.
 * `state.metadataValidated` or `state.metadata.scimEnabled`. Continue is
 * enabled when the value at that path is truthy.
 *
 * Kept free of React and app imports so the e2e suite can check every wizard
 * JSON against the same grammar.
 */

const EXPRESSION = /^state((?:\.\w+)+)$/;

/** Path segments after `state`, or null when the expression isn't supported. */
export function parseEnableNextWhen(expression: string): string[] | null {
  const match = expression.trim().match(EXPRESSION);
  return match ? match[1].slice(1).split(".") : null;
}

/**
 * Whether the step's gate is open. A path that runs through a missing or
 * non-object value is closed, and so is an expression that can't be parsed:
 * a typo in a wizard JSON must not silently remove a gate.
 */
export function evaluateEnableNextWhen(expression: string, state: object): boolean {
  const path = parseEnableNextWhen(expression);
  if (!path) {
    console.error(
      `WizardRunner: unsupported enableNextWhen expression: "${expression}"`,
    );
    return false;
  }

  let value: unknown = state;
  for (const key of path) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) {
      return false;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return Boolean(value);
}
