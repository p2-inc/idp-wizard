import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { allProviders } from "@/data/providers";

export const Route = createFileRoute("/_authenticated/wizard/$providerId")({
  beforeLoad: ({ params }) => {
    const provider = allProviders.find((p) => p.id === params.providerId);
    if (!provider) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
