import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Search, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  providers,
  type Protocol,
  type Provider,
} from "@/data/providers";
import { useWizardConfig } from "@/hooks/useWizardConfig";

export const Route = createFileRoute("/_authenticated/")({
  component: ProviderSelector,
});

const FALLBACK_LOGO = "/phasetwo-logos/logo_phase_slash.svg";

const protocolBadgeClass: Record<Protocol, string> = {
  saml: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  oidc: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ldap: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
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
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent",
        !isLast && "border-border border-b",
      )}
    >
      <img
        src={provider.logo}
        alt={provider.name}
        className="h-7 w-7 shrink-0 object-contain"
      />
      <span className="flex-1 text-sm font-medium">{provider.name}</span>
      <div className="flex gap-1">
        {provider.protocols.map((p) => (
          <ProtocolBadge key={p} protocol={p} />
        ))}
      </div>
    </button>
  );
}

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

function ProviderSelector() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { config } = useWizardConfig();

  const logoSrc = config.logoUrl ?? FALLBACK_LOGO;

  const fuse = useMemo(
    () =>
      new Fuse([...providers, ...genericProviders], {
        keys: ["name"],
        threshold: 0.4,
      }),
    [],
  );

  const filteredProviders = query
    ? fuse.search(query).map((r) => r.item)
    : null;

  const handleSelect = (provider: Provider) => {
    if (provider.protocols.length === 1) {
      navigate({
        to: "/wizard/$providerId/$protocol",
        params: { providerId: provider.id, protocol: provider.protocols[0] },
      });
    } else {
      navigate({
        to: "/wizard/$providerId",
        params: { providerId: provider.id },
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      {/* Branding above the card */}
      <div className="flex flex-col items-center gap-3">
        <img
          src={logoSrc}
          alt={config.appName ?? "Phase Two"}
          className="h-14 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO;
          }}
        />
        {config.appName && (
          <p className="text-sm font-medium text-foreground">
            {config.appName}
          </p>
        )}
      </div>

      {/* Card */}
      <div className="bg-card border-border w-full max-w-sm overflow-hidden rounded-xl border shadow-md">
        {/* Search */}
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

        {/* List */}
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
              {/* Specific providers */}
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

              {/* Generics */}
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

      {/* Help link below card */}
      <div className="flex w-full max-w-sm justify-center">
        <InstructionsDialog />
      </div>
    </div>
  );
}
