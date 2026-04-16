/**
 * WizardRunner — loads a wizard JSON definition and renders the current step.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  [← Providers]         [Provider logo + name]       │  ← _authenticated.tsx header
 *   ├───────────────────┬─────────────────────────────────┤
 *   │  Step 1           │  Step content                   │
 *   │  Step 2  ←sidebar │                                 │
 *   │  Step 3           │                                 │
 *   │                   │                                 │
 *   │  [P2 logo]        │  [Back]  [Continue]             │
 *   └───────────────────┴─────────────────────────────────┘
 */
import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Construction } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useWizardContext } from "@/context/WizardContext";
import { useWizardConfig } from "@/hooks/useWizardConfig";
import { WizardStep } from "./WizardStep";
import { executeAction } from "./executeAction";
import type { WizardDefinition } from "./types";
import type { Provider } from "@/data/providers";
import { cn } from "@/lib/utils";

interface Props {
  providerId: string;
  protocol: string;
  provider: Provider;
}

const FALLBACK_LOGO = "/phasetwo-logos/logo_phase_slash.svg";

export function WizardRunner({ providerId, protocol, provider }: Props) {
  const ctx = useWizardContext();
  const {
    state,
    dispatch,
    api,
    orgsClient,
    adminClient,
    apiMode,
    realm,
    orgId,
  } = ctx;
  const { config } = useWizardConfig();

  const [definition, setDefinition] = useState<WizardDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load the wizard JSON definition
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
      .then((mod) =>
        setDefinition((mod as { default: WizardDefinition }).default),
      )
      .catch(() => setLoadError("not-found"));
  }, [providerId, protocol]);

  // ---------------------------------------------------------------------------
  // Action handler
  // ---------------------------------------------------------------------------
  const handleAction = async (
    actionKey: string,
    formValues?: Record<string, unknown>,
  ): Promise<boolean> => {
    if (!definition) return false;
    const action = definition.actions[actionKey];
    if (!action) {
      console.warn(`WizardRunner: unknown action key "${actionKey}"`);
      return false;
    }

    dispatch({ type: "SUBMIT_START" });

    const result = await executeAction({
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
      config,
    });

    // Ensure submitting is cleared if the action didn't dispatch SUBMIT_SUCCESS
    // or SUBMIT_ERROR (e.g. intermediate steps that only dispatch METADATA_VALIDATED).
    if (result.ok) dispatch({ type: "RESET_SUBMITTING" });

    return result.ok;
  };

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <Construction className="text-muted-foreground/50 h-10 w-10" />
        <p className="font-medium">Wizard not yet available</p>
        <p className="text-muted-foreground max-w-xs text-base">
          A guided setup for this provider and protocol hasn't been built yet.
          Check back soon or configure it manually in the Keycloak admin
          console.
        </p>
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-base">
        Loading wizard…
      </div>
    );
  }

  const currentStep = definition.steps.find((s) => s.id === state.currentStep);
  if (!currentStep) return null;

  const isLastStep =
    state.currentStep === definition.steps[definition.steps.length - 1].id;
  const canAdvance = currentStep.enableNextWhen
    ? evaluateExpression(currentStep.enableNextWhen, state)
    : true;

  const sidebarLogo = config.logoUrl ?? FALLBACK_LOGO;

  return (
    <div className="flex h-full min-h-0">
      {/* ------------------------------------------------------------------ */}
      {/* Left sidebar                                                        */}
      {/* ------------------------------------------------------------------ */}
      <aside className="border-border flex w-60 shrink-0 flex-col border-r">
        {/* Provider identity */}
        <div className="border-border flex flex-col gap-2 border-b px-4 py-4 items-start">
          <img
            src={provider.logo}
            alt={provider.name}
            title={provider.name}
            className="max-h-16 w-auto object-contain"
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ol className="flex flex-col gap-1">
            {definition.steps.map((step) => {
              const isActive = step.id === state.currentStep;
              const isReached = step.id <= state.stepIdReached;
              return (
                <li key={step.id}>
                  <button
                    onClick={() =>
                      isReached &&
                      dispatch({ type: "ADVANCE_STEP", toStep: step.id })
                    }
                    disabled={!isReached}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-accent font-medium text-foreground"
                        : isReached
                          ? "text-muted-foreground hover:text-foreground"
                          : "cursor-default text-muted-foreground/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isReached
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted/40 text-muted-foreground/40",
                      )}
                    >
                      {step.id}
                    </span>
                    {step.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Dev context box */}
        {import.meta.env.DEV && (
          <div className="border-border mx-3 mb-3 rounded-md border bg-muted/50 px-3 py-2 font-mono text-[10px]">
            {[
              ["apiMode", apiMode],
              ["orgId", orgId ?? "—"],
              ["realm", realm],
              ["alias", state.alias],
              ["step", `${state.currentStep}/${state.stepIdReached}`],
            ].map(([key, val]) => (
              <div key={key}>
                <span className="font-semibold text-foreground">{key}:</span>
                <span className="text-muted-foreground"> {val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom: back to providers + Phase Two logo */}
        <div className="flex flex-col">
          <div className="flex flex-col gap-2 px-4 pb-3">
            <span className="bg-muted border-border text-muted-foreground inline-flex w-fit rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide">
              {protocol}
            </span>
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Providers
            </Link>
          </div>
          <div className="border-border border-t p-4">
            <img
              src={sidebarLogo}
              alt={config.appName ?? "Phase Two"}
              className="h-6 object-contain opacity-90"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO;
              }}
            />
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Step content */}
        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
          <WizardStep
            step={currentStep}
            forms={definition.forms}
            onAction={handleAction}
          />

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-end gap-3">
            {state.currentStep > 1 && (
              <button
                onClick={() =>
                  dispatch({
                    type: "ADVANCE_STEP",
                    toStep: state.currentStep - 1,
                  })
                }
                className="border-border rounded-md border px-4 py-2 text-base transition-colors hover:bg-accent"
              >
                Back
              </button>
            )}
            {!isLastStep && (
              <button
                onClick={() =>
                  dispatch({
                    type: "ADVANCE_STEP",
                    toStep: state.currentStep + 1,
                  })
                }
                disabled={!canAdvance}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expression evaluator for enableNextWhen
// ---------------------------------------------------------------------------
function evaluateExpression(
  expression: string,
  state: import("@/context/WizardContext").WizardState,
): boolean {
  const trimmed = expression.trim();

  const stateMatch = trimmed.match(/^state\.(\w+)$/);
  if (stateMatch) {
    const field = stateMatch[1] as keyof typeof state;
    return Boolean(state[field]);
  }

  console.warn(
    `WizardRunner: unknown enableNextWhen expression: "${expression}"`,
  );
  return true;
}
