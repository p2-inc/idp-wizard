import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div>
      <h1>Identity Provider Wizard</h1>
      <p>Provider selector coming soon.</p>
    </div>
  );
}
