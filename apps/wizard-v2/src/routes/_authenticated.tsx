import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { allProviders } from "@/data/providers";

const APP_SHELL_MAX_WIDTH = "max-w-[1440px]";

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
        <header className="border-border shrink-0 border-b">
          <div
            className={`mx-auto flex w-full items-center justify-between px-4 py-2 ${APP_SHELL_MAX_WIDTH}`}
          >
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
          </div>
        </header>
      )}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${APP_SHELL_MAX_WIDTH}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
