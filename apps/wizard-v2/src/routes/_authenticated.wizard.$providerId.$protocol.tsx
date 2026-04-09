import { createFileRoute, redirect } from "@tanstack/react-router";
import { allProviders, type Protocol } from "@/data/providers";

export const Route = createFileRoute(
  "/_authenticated/wizard/$providerId/$protocol",
)({
  beforeLoad: ({ params }) => {
    const provider = allProviders.find((p) => p.id === params.providerId);
    if (!provider) throw redirect({ to: "/" });
    if (!provider.protocols.includes(params.protocol as Protocol)) {
      throw redirect({ to: "/wizard/$providerId", params });
    }
  },
  component: WizardRunner,
});

function WizardRunner() {
  const { providerId, protocol } = Route.useParams();
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
          <p className="text-muted-foreground text-sm uppercase tracking-wide">
            {protocol}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">Wizard runner coming soon.</p>
    </div>
  );
}
