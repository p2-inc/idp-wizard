import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CopyField } from "@/components/ui/copy-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/style-guide")({
  component: StyleGuide,
});

// ---------------------------------------------------------------------------
// Color tokens to display
// ---------------------------------------------------------------------------

const COLOR_TOKENS: { label: string; bg: string; fg?: string }[] = [
  { label: "background", bg: "bg-background", fg: "text-foreground" },
  { label: "foreground", bg: "bg-foreground", fg: "text-background" },
  { label: "card", bg: "bg-card", fg: "text-card-foreground" },
  { label: "popover", bg: "bg-popover", fg: "text-popover-foreground" },
  { label: "primary", bg: "bg-primary", fg: "text-primary-foreground" },
  { label: "secondary", bg: "bg-secondary", fg: "text-secondary-foreground" },
  { label: "muted", bg: "bg-muted", fg: "text-muted-foreground" },
  { label: "accent", bg: "bg-accent", fg: "text-accent-foreground" },
  { label: "destructive", bg: "bg-destructive", fg: "text-destructive-foreground" },
  { label: "border", bg: "bg-border", fg: "text-foreground" },
  { label: "input", bg: "bg-input", fg: "text-foreground" },
  { label: "ring", bg: "bg-ring", fg: "text-white" },
  { label: "success", bg: "bg-success", fg: "text-success-foreground" },
  { label: "warning", bg: "bg-warning", fg: "text-warning-foreground" },
  { label: "chart-1", bg: "bg-chart-1", fg: "text-white" },
  { label: "chart-2", bg: "bg-chart-2", fg: "text-white" },
  { label: "chart-3", bg: "bg-chart-3", fg: "text-white" },
  { label: "chart-4", bg: "bg-chart-4", fg: "text-white" },
  { label: "chart-5", bg: "bg-chart-5", fg: "text-white" },
];

// ---------------------------------------------------------------------------
// Fake attribute table rows for demo
// ---------------------------------------------------------------------------

const DEMO_ROWS = [
  { idpAttribute: "subject", keycloakAttribute: "username" },
  { idpAttribute: "email", keycloakAttribute: "email" },
  { idpAttribute: "firstName", keycloakAttribute: "firstName" },
];

function InlineCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cn(
        "ml-1.5 shrink-0 rounded p-0.5 opacity-0 transition-all group-hover:opacity-100",
        copied ? "text-green-600" : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-border border-b pb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Style guide page
// ---------------------------------------------------------------------------

function StyleGuide() {
  const [inputVal, setInputVal] = useState("");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Style Guide</h1>
        <p className="text-muted-foreground mt-1 text-sm">All design tokens and components at a glance.</p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Color tokens                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Color Tokens">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {COLOR_TOKENS.map(({ label, bg, fg }) => (
            <div key={label} className="border-border overflow-hidden rounded-lg border">
              <div className={cn("flex h-14 items-center justify-center", bg)}>
                <span className={cn("text-xs font-medium", fg)}>{label}</span>
              </div>
              <div className="bg-card px-2 py-1">
                <code className="text-muted-foreground text-[10px]">--{label}</code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Typography                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-bold">Heading — 2xl bold</p>
          <p className="text-xl font-semibold">Heading — xl semibold</p>
          <p className="text-lg font-semibold">Heading — lg semibold</p>
          <p className="text-base font-medium">Body — base medium</p>
          <p className="text-sm">Body — sm regular</p>
          <p className="text-muted-foreground text-sm">Body — sm muted</p>
          <p className="text-xs">Caption — xs regular</p>
          <code className="font-mono text-sm">Monospace — code sample</code>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Buttons                                                           */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Large</Button>
          <Button size="default">Default</Button>
          <Button size="sm">Small</Button>
          <Button size="xs">XS</Button>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Inputs                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Inputs">
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Text input placeholder…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <Input type="password" placeholder="Password input" />
          <Input type="url" placeholder="https://example.com" />
          <Input disabled placeholder="Disabled input" />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Copy field                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Copy Field">
        <CopyField label="Entity ID" value="https://auth.example.com/realms/wizard" />
        <CopyField
          label="Redirect URI"
          value="https://auth.example.com/realms/wizard/broker/saml/endpoint"
          hint="Paste this URL into your IdP's ACS URL field."
        />
        <CopyField label="Empty value" value="" />
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Tabs                                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Tabs">
        <Tabs defaultValue="tab1">
          <TabsList className="w-full">
            <TabsTrigger value="tab1" className="flex-1">Option A</TabsTrigger>
            <TabsTrigger value="tab2" className="flex-1">Option B</TabsTrigger>
            <TabsTrigger value="tab3" className="flex-1">Option C</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <div className="bg-card border-border mt-4 rounded-lg border p-4 text-sm">Content for Option A</div>
          </TabsContent>
          <TabsContent value="tab2">
            <div className="bg-card border-border mt-4 rounded-lg border p-4 text-sm">Content for Option B</div>
          </TabsContent>
          <TabsContent value="tab3">
            <div className="bg-card border-border mt-4 rounded-lg border p-4 text-sm">Content for Option C</div>
          </TabsContent>
        </Tabs>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Attribute Table                                                   */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Attribute Table">
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="border-border grid grid-cols-2 border-b bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
            <span>Identity Provider Attribute</span>
            <span>Keycloak Attribute</span>
          </div>
          {DEMO_ROWS.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-2 bg-card px-4 py-2.5 font-mono text-xs",
                i !== DEMO_ROWS.length - 1 && "border-border border-b",
              )}
            >
              <span className="group flex items-center">
                {row.idpAttribute}
                <InlineCopy value={row.idpAttribute} />
              </span>
              <span className="group flex items-center text-muted-foreground">
                {row.keycloakAttribute}
                <InlineCopy value={row.keycloakAttribute} />
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* State badges / surfaces                                           */}
      {/* ---------------------------------------------------------------- */}
      <Section title="State Surfaces">
        <div className="flex flex-col gap-2">
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Error — something went wrong. Please try again.
          </p>
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            Success — the operation completed successfully.
          </p>
          <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            Warning — please review before continuing.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Card / form surface                                               */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Card / Form Surface">
        <div className="bg-card rounded-lg border p-5">
          <p className="text-muted-foreground mb-4 text-sm">
            This is a sample form card. Labels, inputs, and submit button shown below.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Display Name <span className="text-destructive">*</span></label>
              <Input placeholder="My SAML App" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Metadata URL</label>
              <Input type="url" placeholder="https://idp.example.com/metadata.xml" />
            </div>
            <button className="mt-1 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Validate
            </button>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Border / radius reference                                         */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Border Radius">
        <div className="flex flex-wrap items-center gap-4">
          {(["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-full"] as const).map((r) => (
            <div key={r} className={cn("border-border h-12 w-12 border-2 bg-primary/20", r)} />
          ))}
          <div className="text-muted-foreground text-xs">
            sm · md · lg · xl · full
          </div>
        </div>
      </Section>
    </div>
  );
}
