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

  const sessionKey = `p2_${providerId}_${protocol}`;
  const alias = getOrCreateAlias(sessionKey, `${providerId}-${protocol}`);

  const apiContext = useWizardApi(orgId);

  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialWizardState(alias),
  );

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
      <div className="min-h-0 flex-1">
        <WizardRunner providerId={providerId} protocol={protocol} provider={provider} />
      </div>
    </WizardContext.Provider>
  );
}
