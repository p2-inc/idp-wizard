/**
 * WizardStep — renders a single step from a wizard JSON definition.
 *
 * Iterates over the step's `blocks` array and delegates each block to the
 * appropriate block renderer. This component is stateless — all state lives
 * in WizardContext.
 */
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { WizardStep as WizardStepDef, WizardBlock, WizardForm, FormField } from "./types";
import { resolveTemplate, buildTemplateContext } from "./resolveTemplate";
import { useWizardContext } from "@/context/WizardContext";
import { CopyField } from "@/components/ui/copy-field";
import { FileInput } from "@/components/ui/file-input";
import { ImageZoom } from "./ImageZoom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Props {
  step: WizardStepDef;
  forms: Record<string, WizardForm>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<boolean>;
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
// Block dispatcher
// ---------------------------------------------------------------------------

interface BlockProps {
  block: WizardBlock;
  ctx: Record<string, unknown>;
  forms: Record<string, WizardForm>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<boolean>;
}

function BlockRenderer({ block, ctx, forms, onAction }: BlockProps) {
  switch (block.type) {
    case "text":
      return <TextBlockRenderer content={block.content} />;

    case "copy":
      return (
        <CopyField
          label={block.label}
          value={resolveTemplate(block.value, ctx)}
          hint={block.hint}
        />
      );

    case "image":
      return (
        <ImageZoom
          src={resolveTemplate(block.src, ctx)}
          alt={block.alt}
          caption={block.caption}
          fullWidth={block.fullWidth}
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
      return null;
  }
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function TextBlockRenderer({ content }: { content: string }) {
  return <p className="text-muted-foreground text-sm leading-relaxed">{content}</p>;
}

function FormGroupRenderer({
  block,
  forms,
  onAction,
}: {
  block: import("./types").FormGroupBlock;
  forms: Record<string, WizardForm>;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<boolean>;
}) {
  const validForms = block.forms.filter((k) => forms[k]);

  if (block.exclusive && validForms.length > 1) {
    return (
      <Tabs defaultValue={validForms[0]}>
        <TabsList className="w-full">
          {validForms.map((formKey) => (
            <TabsTrigger key={formKey} value={formKey} className="flex-1">
              {forms[formKey].title}
            </TabsTrigger>
          ))}
        </TabsList>
        {validForms.map((formKey) => (
          <TabsContent key={formKey} value={formKey} className="mt-4">
            <FormRenderer formKey={formKey} form={forms[formKey]} onAction={onAction} />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {validForms.map((formKey) => (
        <FormRenderer key={formKey} formKey={formKey} form={forms[formKey]} onAction={onAction} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormRenderer — controlled form with real inputs
// ---------------------------------------------------------------------------

function FormRenderer({
  formKey,
  form,
  onAction,
}: {
  formKey: string;
  form: WizardForm;
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<boolean>;
}) {
  const { state } = useWizardContext();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const setValue = (id: string, v: unknown) => {
    setSucceeded(false);
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const field of form.fields) {
      const v = values[field.id];
      if (field.required && (v === undefined || v === null || v === "")) {
        next[field.id] = `${field.label} is required.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSucceeded(false);
    try {
      const ok = await onAction(form.submit.action, values);
      if (ok) setSucceeded(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-5">
      {form.description && (
        <p className="text-muted-foreground mb-4 text-sm">{form.description}</p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {form.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors[field.id]}
            onChange={(v) => {
              setValue(field.id, v);
              if (errors[field.id]) setErrors((prev) => { const n = { ...prev }; delete n[field.id]; return n; });
            }}
          />
        ))}

        {state.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        {succeeded ? (
          <div className="mt-1 flex items-center justify-center gap-2 rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Validated
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Working…" : form.submit.label}
          </button>
        )}
      </form>
    </div>
  );

  // suppress unused var — formKey is used by the parent for tab keys
  void formKey;
}

// ---------------------------------------------------------------------------
// FieldRenderer — dispatches to the right input type
// ---------------------------------------------------------------------------

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const baseInput = cn(
    "border-border w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors",
    "placeholder:text-muted-foreground",
    "focus:ring-2 focus:ring-ring focus:ring-offset-1",
    error && "border-destructive focus:ring-destructive",
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </label>

      {field.type === "file" ? (
        <FileInput
          accept={field.accept}
          required={field.required}
          value={(value as File) ?? null}
          onChange={onChange}
        />
      ) : field.type === "textarea" ? (
        <textarea
          placeholder={field.placeholder}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={cn(baseInput, "resize-none")}
        />
      ) : (
        <input
          type={
            field.type === "password"
              ? "password"
              : field.type === "url"
                ? "url"
                : "text"
          }
          placeholder={field.placeholder}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          autoComplete={field.type === "password" ? "current-password" : undefined}
        />
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
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
          className={cn(
            "grid grid-cols-2 px-4 py-2.5 font-mono text-xs",
            i !== rows.length - 1 && "border-border border-b",
          )}
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
  onAction: (actionKey: string, formValues?: Record<string, unknown>) => Promise<boolean>;
}) {
  const { state, apiMode } = useWizardContext();
  const adminLink = block.adminLink && apiMode === "onprem"
    ? resolveTemplate(block.adminLink, ctx)
    : "";

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
