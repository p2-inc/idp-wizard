import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ThemeProvider } from "./components/theme-provider";
import { initOidc } from "./oidc";
import { getBasepath, loadRuntimeConfig } from "./runtime-config";
import "./index.css";

// The SPI serves the app under /realms/{realm}/wizard/, so client-side routing has to
// be told where the app root is. Derived synchronously from <base href> to keep the
// router at module scope (TanStack's module augmentation needs `typeof router`).
const router = createRouter({ routeTree, basepath: getBasepath() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;

function renderFatal(message: string) {
  createRoot(rootElement).render(
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
        Wizard failed to start
      </h1>
      <p style={{ color: "#666" }}>{message}</p>
    </div>,
  );
}

// Configuration is resolved from the server before anything renders. Failing loudly
// here is deliberate: the previous build-time-env approach failed silently and left
// the wizard running against defaults with no indication anything was wrong.
loadRuntimeConfig()
  .then((config) => initOidc(config))
  .then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <ThemeProvider defaultTheme="system" storageKey="wizard-theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error("Wizard startup failed", error);
    renderFatal(error instanceof Error ? error.message : String(error));
  });
