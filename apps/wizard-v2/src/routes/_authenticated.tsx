import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { allProviders } from "@/data/providers";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useRouterState({
    select: (s) => s.matches.at(-1)?.params as Record<string, string> | undefined,
  });

  const isHome = pathname === "/";
  const providerId = params?.providerId;
  const provider = providerId ? allProviders.find((p) => p.id === providerId) : null;

  return (
    <div className="flex h-screen flex-col">
      {!isHome && (
        <header className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Providers
          </Link>

          {provider && (
            <div className="flex items-center gap-2">
              <img
                src={provider.logo}
                alt={provider.name}
                className="h-5 w-5 object-contain"
              />
              <span className="text-sm font-medium">{provider.name}</span>
            </div>
          )}
        </header>
      )}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
