import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import Fuse from "fuse.js";
import {
  Search,
  HelpCircle,
  Building2,
  ChevronDown,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useProviderLogo } from "@/hooks/useProviderLogo";
import { useAppLogo } from "@/hooks/useAppLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  genericProviders,
  popularProviders,
  providers,
  type Protocol,
  type Provider,
} from "@/data/providers";
import { useWizardConfig } from "@/hooks/useWizardConfig";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { isEligible, type OrgOption, type RealmIdpAccess } from "@/lib/org-access";
import { NoIdpAccessNotice } from "@/components/org-access";

const searchSchema = z.object({
  org_id: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: searchSchema,
  component: ProviderSelector,
});

// ---------------------------------------------------------------------------
// Protocol badges
// ---------------------------------------------------------------------------
const protocolBadgeClass: Record<Protocol, string> = {
  saml: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  oidc: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ldap: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  oauth:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  scim: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};

function ProtocolBadge({ protocol }: { protocol: Protocol }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        protocolBadgeClass[protocol],
      )}
    >
      {protocol}
    </span>
  );
}

function ProviderRow({
  provider,
  onSelect,
  isLast,
}: {
  provider: Provider;
  onSelect: (p: Provider) => void;
  isLast: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(provider)}
      className={cn(
        "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent",
        !isLast && "border-border border-b",
      )}
    >
      <div className="flex flex-1 items-center gap-3">
        <img
          src={useProviderLogo(provider.logo)}
          alt={provider.name}
          className="h-12 w-12 shrink-0 object-contain"
          title={provider.name}
        />
        <span className="text-sm font-medium">{provider.name}</span>
      </div>
      <div className="flex gap-1">
        {provider.protocols.map((p) => (
          <ProtocolBadge key={p} protocol={p} />
        ))}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Organization picker
// ---------------------------------------------------------------------------
function PickerOption({
  title,
  subtitle,
  selected,
  monoSubtitle,
  disabledReason,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  /** Render the subtitle in monospace (for ids). */
  monoSubtitle?: boolean;
  /** When set, the option is shown but cannot be chosen, with this explanation. */
  disabledReason?: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={!!disabledReason}
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors",
        disabledReason ? "cursor-not-allowed opacity-60" : "hover:bg-accent",
        selected && "bg-accent",
      )}
    >
      <div>
        <p className="font-medium">{title}</p>
        <p
          className={cn(
            "text-muted-foreground text-xs",
            monoSubtitle && "font-mono",
          )}
        >
          {subtitle}
        </p>
        {disabledReason && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {disabledReason}
          </p>
        )}
      </div>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}

function OrgPicker({
  orgId,
  orgs,
  realmAccess,
  open,
  onOpenChange,
  onChange,
}: {
  orgId: string | null;
  orgs: OrgOption[];
  realmAccess: RealmIdpAccess;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (id: string | null) => void;
}) {
  const globalDenied = realmAccess === "denied";
  const current = orgs.find((o) => o.id === orgId);
  const currentName = orgId
    ? (current?.name ?? orgId)
    : globalDenied
      ? "Select an organization"
      : "Global (realm-wide)";

  const choose = (id: string | null) => {
    onChange(id);
    onOpenChange(false);
  };

  return (
    <div className="w-full max-w-sm">
      <button
        onClick={() => onOpenChange(true)}
        className="border-border bg-card flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{currentName}</span>
        </div>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Organization</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 py-2">
            {/* Realm-wide option — uses the Keycloak Admin API */}
            <PickerOption
              title="Global"
              subtitle="Realm-wide configuration"
              selected={!orgId}
              disabledReason={
                globalDenied
                  ? "Requires the realm roles view-identity-providers and manage-identity-providers"
                  : undefined
              }
              onSelect={() => choose(null)}
            />

            {orgs.length > 0 && <div className="border-border my-1 border-t" />}

            {orgs.map((org) => (
              <PickerOption
                key={org.id}
                title={org.name}
                subtitle={org.id}
                monoSubtitle
                selected={orgId === org.id}
                disabledReason={
                  isEligible(org)
                    ? undefined
                    : `Missing organization role${org.missingRoles.length > 1 ? "s" : ""}: ${org.missingRoles.join(", ")}`
                }
                onSelect={() => choose(org.id)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instructions dialog
// ---------------------------------------------------------------------------
function InstructionsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Not sure where to start?</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Getting started</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            This wizard helps you connect an external identity provider to your
            Keycloak realm.
          </p>
          <ol className="list-decimal space-y-2 pl-4">
            <li>
              <span className="font-medium text-foreground">
                Select a provider
              </span>{" "}
              — choose the identity provider your organization uses, or pick a
              generic protocol if yours isn't listed.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Choose a protocol
              </span>{" "}
              — if the provider supports multiple protocols (e.g. SAML and
              OIDC), you'll be asked which to configure.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Follow the steps
              </span>{" "}
              — the wizard will guide you through the configuration on both
              sides: your identity provider and Keycloak.
            </li>
          </ol>
          <p>
            You'll need admin access to both your identity provider and this
            Keycloak realm to complete the setup.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function ProviderSelector() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { config } = useWizardConfig();
  const { org_id: initialOrgId } = Route.useSearch();

  // Org state — starts from URL param, can be changed via picker
  const [orgId, setOrgId] = useState<string | null>(initialOrgId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { orgs, eligibleOrgs, realmAccess } = useOrgAccess();

  // Without realm identity-provider roles, Global (the Keycloak Admin API) can only end in
  // a 403, so it must not be the silent default: the user has to be in an organization.
  const globalDenied = realmAccess === "denied";
  const needsOrg = globalDenied && !orgId;

  const { src: logoSrc, fallback: fallbackLogo } = useAppLogo();

  const fuse = useMemo(
    () =>
      new Fuse([...popularProviders, ...providers, ...genericProviders], {
        keys: ["name"],
        threshold: 0.4,
      }),
    [],
  );

  const filteredProviders = query
    ? fuse.search(query).map((r) => r.item)
    : null;

  const handleSelect = (provider: Provider) => {
    if (needsOrg && eligibleOrgs.length > 0) {
      setPickerOpen(true);
      return;
    }
    const search = orgId ? { org_id: orgId } : {};
    if (provider.protocols.length === 1) {
      navigate({
        to: "/wizard/$providerId/$protocol",
        params: { providerId: provider.id, protocol: provider.protocols[0] },
        search,
      });
    } else {
      navigate({
        to: "/wizard/$providerId",
        params: { providerId: provider.id },
        search,
      });
    }
  };

  const handleOrgChange = (id: string | null) => {
    setOrgId(id);
    navigate({
      to: "/",
      search: id ? { org_id: id } : {},
      replace: true,
    });
  };

  // With exactly one usable organization there is nothing to choose — select it.
  const onlyOrgId =
    needsOrg && eligibleOrgs.length === 1 ? eligibleOrgs[0].id : null;
  useEffect(() => {
    if (onlyOrgId) handleOrgChange(onlyOrgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyOrgId]);

  // The picker is useful when there is an org to switch to, or when the user can't
  // configure Global and should see which orgs exist and what they lack.
  const showPicker =
    eligibleOrgs.length > 0 || (globalDenied && orgs.length > 0);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <ThemeToggle className="fixed bottom-4 right-4 z-10" />
      {/* Branding */}
      <div className="flex flex-col items-center gap-3">
        <img
          src={logoSrc}
          alt={config.appName ?? "Phase Two"}
          className="h-14 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallbackLogo;
          }}
        />
        {config.appName && (
          <p className="text-sm font-medium text-foreground">
            {config.appName}
          </p>
        )}
      </div>

      {showPicker && (
        <OrgPicker
          orgId={orgId}
          orgs={orgs}
          realmAccess={realmAccess}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChange={handleOrgChange}
        />
      )}

      {globalDenied && eligibleOrgs.length === 0 && (
        <NoIdpAccessNotice className="w-full max-w-sm" />
      )}
      {needsOrg && eligibleOrgs.length > 1 && (
        <p className="text-muted-foreground w-full max-w-sm text-center text-xs">
          Select the organization to configure identity providers for.
        </p>
      )}

      {/* Provider search card */}
      <div className="bg-card border-border w-full max-w-sm overflow-hidden rounded-xl border shadow-md">
        <div className="border-border border-b p-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search providers..."
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filteredProviders ? (
            filteredProviders.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                No providers found.
              </p>
            ) : (
              filteredProviders.map((provider, i) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onSelect={handleSelect}
                  isLast={i === filteredProviders.length - 1}
                />
              ))
            )
          ) : (
            <>
              <div className="text-muted-foreground px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest">
                Popular
              </div>
              {popularProviders.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onSelect={handleSelect}
                  isLast={false}
                />
              ))}

              <div className="border-border border-t" />
              <div className="text-muted-foreground px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest">
                Providers
              </div>
              {providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onSelect={handleSelect}
                  isLast={false}
                />
              ))}

              <div className="border-border border-t" />
              <div className="text-muted-foreground px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest">
                Generic
              </div>
              {genericProviders.map((provider, i) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  onSelect={handleSelect}
                  isLast={i === genericProviders.length - 1}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Help link */}
      <div className="flex w-full max-w-sm justify-center">
        <InstructionsDialog />
      </div>
    </div>
  );
}
