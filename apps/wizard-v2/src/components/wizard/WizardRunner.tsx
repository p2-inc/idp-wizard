/**
 * WizardRunner — loads a wizard JSON definition and renders the current step.
 *
 * Responsibilities:
 * - Import the JSON for the given providerId + protocol
 * - Render the step navigation (sidebar or step indicator)
 * - Render the current step via <WizardStep>
 * - Call executeAction when a form is submitted or the confirm button is clicked
 * - Advance/gate steps based on WizardState
 *
 * The runner is context-aware — it reads from WizardContext for state and API
 * clients. It does not own any state directly.
 *
 * TODO: the JSON loader, step navigation UI, and executeAction integration are
 * all stubs. The step renderer (WizardStep + block renderers) is partially
 * implemented. Build these out in order:
 *   1. JSON loader (dynamic import from wizards/{providerId}/{protocol}.json)
 *   2. Step navigation sidebar (step names, canJumpTo gating, current indicator)
 *   3. Form renderers (controlled inputs, file upload, validation)
 *   4. executeAction HTTP calls (importConfig, createIdp, addMappers)
 *   5. enableNextWhen expression evaluator
 */
import { useState, useEffect } from "react";
import { ChevronRight, Construction } from "lucide-react";
import { useWizardContext } from "@/context/WizardContext";
import { WizardStep } from "./WizardStep";
import { executeAction } from "./executeAction";
import type { WizardDefinition } from "./types";

interface Props {
  providerId: string;
  protocol: string;
}

export function WizardRunner({ providerId, protocol }: Props) {
  const ctx = useWizardContext();
  const { state, dispatch, api, orgsClient, adminClient, apiMode, realm, orgId } = ctx;

  const [definition, setDefinition] = useState<WizardDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load the wizard JSON definition
  //
  // import.meta.glob pre-registers all wizard JSON files at build time so Vite
  // can bundle them. At runtime we look for a provider-specific file first
  // (e.g. wizards/okta/saml.json) and fall back to the generic protocol wizard
  // (wizards/generic/saml.json) if none exists.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const modules = import.meta.glob("../../../wizards/**/*.json");

    const providerKey = `../../../wizards/${providerId}/${protocol}.json`;
    const loader = modules[providerKey];

    if (!loader) {
      setLoadError("not-found");
      return;
    }

    loader()
      .then((mod) => setDefinition((mod as { default: WizardDefinition }).default))
      .catch(() => setLoadError("not-found"));
  }, [providerId, protocol]);

  // ---------------------------------------------------------------------------
  // Action handler — called by WizardStep when a form submits or confirm fires
  // ---------------------------------------------------------------------------
  const handleAction = async (
    actionKey: string,
    formValues?: Record<string, unknown>,
  ) => {
    if (!definition) return;
    const action = definition.actions[actionKey];
    if (!action) {
      console.warn(`WizardRunner: unknown action key "${actionKey}"`);
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    await executeAction({
      actionKey,
      action,
      allActions: definition.actions,
      state,
      dispatch,
      orgsClient,
      adminClient,
      apiMode,
      realm,
      orgId,
      api,
      formValues,
      aliasSessionKey: definition.alias.sessionKey,
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction className="text-muted-foreground/50 h-10 w-10" />
        <p className="font-medium">Wizard not yet available</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          A guided setup for this provider and protocol hasn't been built yet.
          Check back soon or use the generic wizard from the provider selector.
        </p>
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Loading wizard…
      </div>
    );
  }

  const currentStep = definition.steps.find((s) => s.id === state.currentStep);
  if (!currentStep) return null;

  const isLastStep = state.currentStep === definition.steps[definition.steps.length - 1].id;
  const canAdvance = currentStep.enableNextWhen
    ? evaluateExpression(currentStep.enableNextWhen, state)
    : true;

  return (
    <div className="flex gap-8">
      {/* Step sidebar */}
      <aside className="hidden w-48 shrink-0 md:block">
        <ol className="flex flex-col gap-1">
          {definition.steps.map((step) => {
            const isActive = step.id === state.currentStep;
            const isReached = step.id <= state.stepIdReached;
            return (
              <li key={step.id}>
                <button
                  onClick={() =>
                    isReached && dispatch({ type: "ADVANCE_STEP", toStep: step.id })
                  }
                  disabled={!isReached}
                  className={[
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                    isActive
                      ? "bg-accent font-medium text-foreground"
                      : isReached
                        ? "text-muted-foreground hover:text-foreground"
                        : "cursor-default text-muted-foreground/40",
                  ].join(" ")}
                >
                  <span className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isReached
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted/40 text-muted-foreground/40",
                  ].join(" ")}>
                    {step.id}
                  </span>
                  {step.title}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Step content */}
      <div className="flex flex-1 flex-col gap-6">
        <WizardStep
          step={currentStep}
          forms={definition.forms}
          onAction={handleAction}
        />

        {/* Navigation buttons */}
        <div className="flex justify-end gap-3">
          {state.currentStep > 1 && (
            <button
              onClick={() => dispatch({ type: "ADVANCE_STEP", toStep: state.currentStep - 1 })}
              className="border-border rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              Back
            </button>
          )}
          {!isLastStep && (
            <button
              onClick={() => dispatch({ type: "ADVANCE_STEP", toStep: state.currentStep + 1 })}
              disabled={!canAdvance}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expression evaluator for enableNextWhen
//
// Supports simple boolean state lookups: "state.metadataValidated"
// TODO: extend to support comparisons like "state.stepIdReached >= 3"
// ---------------------------------------------------------------------------
function evaluateExpression(
  expression: string,
  state: import("@/context/WizardContext").WizardState,
): boolean {
  const trimmed = expression.trim();

  // "state.fieldName" — direct boolean field lookup
  const stateMatch = trimmed.match(/^state\.(\w+)$/);
  if (stateMatch) {
    const field = stateMatch[1] as keyof typeof state;
    return Boolean(state[field]);
  }

  // Fallback — unknown expression, allow advancement
  console.warn(`WizardRunner: unknown enableNextWhen expression: "${expression}"`);
  return true;
}
