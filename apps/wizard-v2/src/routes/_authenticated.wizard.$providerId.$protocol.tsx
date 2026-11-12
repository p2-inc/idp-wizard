import { useReducer, useEffect, type ReactNode } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { WizardRunner } from "@/components/wizard/WizardRunner";
import { z } from "zod";
import { allProviders, type Protocol, type Provider } from "@/data/providers";
import {
  WizardContext,
  wizardReducer,
  makeInitialWizardState,
} from "@/context/WizardContext";
import { useWizardApi } from "@/hooks/useWizardApi";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { GlobalAccessDeniedGate } from "@/components/org-access";
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

  // SCIM is configured per-organization on the Phase Two backend. There is no
  // realm-wide path today, so block the wizard with a clear message when no
  // org_id is present rather than silently failing on the first API call.
  if (protocol === "scim" && !orgId) {
    return <ScimRequiresOrgGate />;
  }

  return (
    <OrgScopeGate orgId={orgId}>
      <WizardSession
        providerId={providerId}
        protocol={protocol}
        provider={provider}
        orgId={orgId}
      />
    </OrgScopeGate>
  );
}

/**
 * Without `org_id` the wizard uses the realm-wide Keycloak Admin API. Block that for a
 * user known to lack realm identity-provider roles instead of letting every call 403.
 * If the token can't tell us ("unknown"), proceed and let the server decide.
 */
function OrgScopeGate({
  orgId,
  children,
}: {
  orgId: string | null;
  children: ReactNode;
}) {
  const { eligibleOrgs, realmAccess } = useOrgAccess();
  if (orgId) return children;
  if (realmAccess === "loading") return null;
  if (realmAccess === "denied") {
    return <GlobalAccessDeniedGate hasOrgs={eligibleOrgs.length > 0} />;
  }
  return children;
}

function WizardSession({
  providerId,
  protocol,
  provider,
  orgId,
}: {
  providerId: string;
  protocol: string;
  provider: Provider;
  orgId: string | null;
}) {
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

function ScimRequiresOrgGate() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-16 text-center">
      <Building2 className="text-muted-foreground/60 h-10 w-10" />
      <h1 className="text-2xl font-semibold">Pick an organization</h1>
      <p className="text-muted-foreground text-base leading-relaxed">
        SCIM provisioning is configured per organization. Launch this wizard
        from an organization context — the upstream IdP needs to push users
        and groups into a specific org.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Choose an organization
      </Link>
    </div>
  );
}
