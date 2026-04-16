import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { allProviders, type Protocol } from "@/data/providers";

const searchSchema = z.object({
  org_id: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/wizard/$providerId/")({
  validateSearch: searchSchema,
  component: ProtocolPicker,
});

const protocolLabels: Record<Protocol, { label: string; description: string }> = {
  saml: {
    label: "SAML",
    description: "Security Assertion Markup Language — XML-based federation standard.",
  },
  oidc: {
    label: "OpenID Connect",
    description: "OAuth 2.0 identity layer — JSON-based, commonly used for modern apps.",
  },
  ldap: {
    label: "LDAP",
    description: "Lightweight Directory Access Protocol — directory sync and authentication.",
  },
};

function ProtocolPicker() {
  const { providerId } = Route.useParams();
  const { org_id: orgId } = Route.useSearch();
  const navigate = useNavigate();
  const provider = allProviders.find((p) => p.id === providerId)!;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-10">
      <div className="flex items-center gap-4">
        <img
          src={provider.logo}
          alt={provider.name}
          className="h-10 w-10 object-contain"
        />
        <div>
          <h1 className="text-2xl font-semibold">{provider.name}</h1>
          <p className="text-muted-foreground text-sm">
            Choose a protocol to configure.
          </p>
        </div>
      </div>

      <div className="border-border rounded-lg border">
        {provider.protocols.map((protocol, i) => {
          const meta = protocolLabels[protocol];
          return (
            <button
              key={protocol}
              onClick={() =>
                navigate({
                  to: "/wizard/$providerId/$protocol",
                  params: { providerId, protocol },
                  search: orgId ? { org_id: orgId } : {},
                })
              }
              className={[
                "flex w-full flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-accent",
                i !== provider.protocols.length - 1 ? "border-border border-b" : "",
              ].join(" ")}
            >
              <span className="text-sm font-medium">{meta.label}</span>
              <span className="text-muted-foreground text-xs">{meta.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
