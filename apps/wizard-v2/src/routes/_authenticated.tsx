import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen flex-col">
      <nav className="border-border flex shrink-0 gap-4 border-b px-4 py-3 text-sm">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          Provider Selector
        </Link>
        <Link
          to="/wizard/$providerId/$protocol"
          params={{ providerId: "saml", protocol: "saml" }}
          className="text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
        >
          Generic SAML
        </Link>
      </nav>
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
