/**
 * WizardStep — renders a single step from a wizard JSON definition.
 *
 * Iterates over the step's `blocks` array and delegates each block to the
 * appropriate block renderer. This component is stateless — all state lives
 * in WizardContext.
 *
 * TODO: implement block renderers as this component is fleshed out.
 * Current stubs display placeholder UI so the runner can be wired up end-to-end
 * before individual blocks are polished.
 */
import type { WizardStep as WizardStepDef, WizardBlock } from "./types";
import { resolveTemplate, buildTemplateContext } from "./resolveTemplate";
import { useWizardContext } from "@/context/WizardContext";

interface Props {
  step: WizardStepDef;
  forms: Record<string, import("./types").WizardForm>;
  /** Called when the user submits a form or clicks the confirm button */
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<void>;
}

export function WizardStep({ step, forms, onAction }: Props) {
  const { state, api } = useWizardContext();

  const ctx = buildTemplateContext({ alias: state.alias, api, state });

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{step.title}</h2>
      {step.blocks.map((block, i) => (
        <BlockRenderer
          key={i}
          block={block}
          ctx={ctx}
          forms={forms}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

interface BlockProps {
  block: WizardBlock;
  ctx: Record<string, unknown>;
  forms: Record<string, import("./types").WizardForm>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<void>;
}

function BlockRenderer({ block, ctx, forms, onAction }: BlockProps) {
  switch (block.type) {
    case "text":
      return <TextBlockRenderer content={block.content} />;

    case "copy":
      return (
        <CopyBlockRenderer
          label={block.label}
          value={resolveTemplate(block.value, ctx)}
          hint={block.hint}
        />
      );

    case "formGroup":
      return (
        <FormGroupRenderer
          block={block}
          forms={forms}
          onAction={onAction}
        />
      );

    case "attributeTable":
      return <AttributeTableRenderer rows={block.rows} />;

    case "confirm":
      return (
        <ConfirmBlockRenderer
          block={block}
          ctx={ctx}
          onAction={onAction}
        />
      );

    default:
      // Exhaustiveness check — will surface unknown block types at compile time
      return null;
  }
}

// ---------------------------------------------------------------------------
// Individual block stubs
// Each one is a separate named component so they can be extracted to their
// own files once the implementation grows.
// ---------------------------------------------------------------------------

function TextBlockRenderer({ content }: { content: string }) {
  return <p className="text-muted-foreground text-sm">{content}</p>;
}

function CopyBlockRenderer({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const handleCopy = () => navigator.clipboard.writeText(value);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="border-border flex items-center gap-2 rounded-md border px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs">{value || "—"}</code>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs transition-colors"
          disabled={!value}
        >
          Copy
        </button>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function FormGroupRenderer({
  block,
  forms,
  onAction,
}: {
  block: import("./types").FormGroupBlock;
  forms: Record<string, import("./types").WizardForm>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<void>;
}) {
  // TODO: render as tabs (exclusive) or accordion; for now show all forms stacked
  return (
    <div className="flex flex-col gap-4">
      {block.forms.map((formKey) => {
        const form = forms[formKey];
        if (!form) return null;
        return (
          <FormRenderer
            key={formKey}
            formKey={formKey}
            form={form}
            onAction={onAction}
          />
        );
      })}
    </div>
  );
}

function FormRenderer({
  formKey,
  form,
  onAction,
}: {
  formKey: string;
  form: import("./types").WizardForm;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<void>;
}) {
  // TODO: implement controlled form state, validation, file inputs
  // For now: renders a placeholder so the step renders without crashing
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-sm font-medium">{form.title}</p>
      <p className="text-muted-foreground text-xs">{form.description}</p>
      <p className="text-muted-foreground mt-3 text-xs italic">
        [{formKey} form — not yet implemented]
      </p>
      <button
        onClick={() => onAction(form.submit.action, {})}
        className="border-border mt-3 rounded border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
      >
        {form.submit.label}
      </button>
    </div>
  );
}

function AttributeTableRenderer({
  rows,
}: {
  rows: import("./types").AttributeRow[];
}) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="border-border grid grid-cols-2 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
        <span>Identity Provider Attribute</span>
        <span>Keycloak Attribute</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-2 px-4 py-2.5 font-mono text-xs ${
            i !== rows.length - 1 ? "border-border border-b" : ""
          }`}
        >
          <span>{row.idpAttribute}</span>
          <span className="text-muted-foreground">{row.keycloakAttribute}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmBlockRenderer({
  block,
  ctx,
  onAction,
}: {
  block: import("./types").ConfirmBlock;
  ctx: Record<string, unknown>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<void>;
}) {
  const { state } = useWizardContext();
  const adminLink = resolveTemplate(block.adminLink, ctx);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium">{block.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{block.description}</p>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.result && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
          {state.result}
        </p>
      )}

      {!state.submitted && (
        <button
          onClick={() => onAction(block.action)}
          disabled={state.submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state.submitting ? "Creating…" : block.buttonText}
        </button>
      )}

      {state.submitted && adminLink && (
        <a
          href={adminLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-md border px-4 py-2.5 text-center text-sm transition-colors hover:bg-accent"
        >
          {block.adminButtonText}
        </a>
      )}
    </div>
  );
}
