import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { OidcInitializationGate } from "../oidc";

export const Route = createRootRoute({
  component: () => (
    <OidcInitializationGate>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </OidcInitializationGate>
  ),
});
