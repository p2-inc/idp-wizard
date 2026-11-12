import { Link } from "@tanstack/react-router";
import { Building2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown when the user can configure neither Global (no realm identity-provider roles)
 * nor any organization (no org with the identity-provider roles).
 */
export function NoIdpAccessNotice({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "border-border bg-card flex gap-3 rounded-lg border px-4 py-3 text-sm",
        className,
      )}
    >
      <ShieldAlert className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">You can't configure identity providers</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Your account needs the <code>view-identity-providers</code> and{" "}
          <code>manage-identity-providers</code> roles in an organization, or
          the realm-management roles of the same names for realm-wide setup.
          Ask an administrator to grant them.
        </p>
      </div>
    </div>
  );
}

/**
 * Route-level gate for a wizard opened without `org_id` by a user who cannot use the
 * realm-wide Admin API — continuing would only fail with 403 on the first API call.
 */
export function GlobalAccessDeniedGate({ hasOrgs }: { hasOrgs: boolean }) {
  if (!hasOrgs) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-16">
        <NoIdpAccessNotice className="w-full" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-16 text-center">
      <Building2 className="text-muted-foreground/60 h-10 w-10" />
      <h1 className="text-2xl font-semibold">Pick an organization</h1>
      <p className="text-muted-foreground text-base leading-relaxed">
        Your account can configure identity providers for an organization,
        but not realm-wide. Choose the organization to set this one up for.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Choose an organization
      </Link>
    </div>
  );
}
