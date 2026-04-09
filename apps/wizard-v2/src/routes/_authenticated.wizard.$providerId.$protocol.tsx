import { useReducer, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { WizardRunner } from "@/components/wizard/WizardRunner";
import { z } from "zod";
import { allProviders, type Protocol } from "@/data/providers";
import {
  WizardContext,
  wizardReducer,
  makeInitialWizardState,
} from "@/context/WizardContext";
import { useWizardApi } from "@/hooks/useWizardApi";
import { getOrCreateAlias } from "@/lib/alias";

const searchSchema = z.object({
  org_id: z.string().optional(),
});

export const Route = createFileRoute(
  "/_authenticated/wizard/$providerId/$protocol",
)({
  validateSearch: searchSchema,
  beforeLoad: ({ params }) => {
    const provider = allProviders.find((p) => p.id === params.providerId);
    if (!provider) throw redirect({ to: "/" });
    if (!provider.protocols.includes(params.protocol as Protocol)) {
      throw redirect({ to: "/wizard/$providerId", params });
    }
  },
  component: WizardPage,
});

function WizardPage() {
  const { providerId, protocol } = Route.useParams();
  const { org_id: orgId = null } = Route.useSearch();
  const provider = allProviders.find((p) => p.id === providerId)!;

  // Resolve wizard JSON — keyed as `{providerId}/{protocol}`
  // Alias is generated once per session per provider+protocol pair
  const sessionKey = `p2_${providerId}_${protocol}`;
  const alias = getOrCreateAlias(sessionKey, `${providerId}-${protocol}`);

  const apiContext = useWizardApi(orgId);

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialWizardState(alias),
  );

  // Sync alias into reducer state (alias is stable after first render)
  useEffect(() => {
    if (state.alias !== alias) {
      dispatch({ type: "ADVANCE_STEP", toStep: state.currentStep });
    }
  }, [alias, state.alias, state.currentStep]);

  const contextValue: import("@/context/WizardContext").WizardContextValue = {
    ...apiContext,
    state,
    dispatch,
  };

  return (
    <WizardContext.Provider value={contextValue}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-10">
        {/* Provider header */}
        <div className="flex items-center gap-4">
          <img
            src={provider.logo}
            alt={provider.name}
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="text-2xl font-semibold">{provider.name}</h1>
            <p className="text-muted-foreground text-sm uppercase tracking-wide">
              {protocol}
            </p>
          </div>
        </div>

        {/* Context debug strip (dev only) */}
        {import.meta.env.DEV && (
          <div className="bg-card text-muted-foreground rounded-lg border p-3 font-mono text-xs">
            <div>
              <span className="font-semibold">apiMode:</span> {apiContext.apiMode}
            </div>
            <div>
              <span className="font-semibold">orgId:</span> {orgId ?? "—"}
            </div>
            <div>
              <span className="font-semibold">realm:</span> {apiContext.realm}
            </div>
            <div>
              <span className="font-semibold">alias:</span> {alias}
            </div>
            <div>
              <span className="font-semibold">step:</span> {state.currentStep} /{" "}
              {state.stepIdReached}
            </div>
            <div>
              <span className="font-semibold">importConfig:</span>{" "}
              {apiContext.api.endpoints.importConfig}
            </div>
            <div>
              <span className="font-semibold">createIdp:</span>{" "}
              {apiContext.api.endpoints.createIdp}
            </div>
          </div>
        )}

        <WizardRunner providerId={providerId} protocol={protocol} />
      </div>
    </WizardContext.Provider>
  );
}
