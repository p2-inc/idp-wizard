import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/oidc";
import { getRuntimeConfig } from "@/runtime-config";

/**
 * Organization display names for the current user, keyed by org id.
 *
 * The `organizations` token claim only carries each org's `name` (a slug such
 * as `acme`), so the picker would otherwise show that instead of "Acme Corp".
 * `GET /realms/{realm}/orgs/me` returns the same orgs with `displayName`.
 *
 * Uses the auth realm, since that is the realm that issued the token and its
 * organizations claim. Best effort: on any failure the map stays empty and
 * callers fall back to the claim's `name`.
 */
export function useOrgDisplayNames(enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled) return;
    const { serverUrl, authRealm } = getRuntimeConfig();
    if (!serverUrl || !authRealm) return;

    let cancelled = false;
    fetchWithAuth(`${serverUrl}/realms/${authRealm}/orgs/me`)
      .then((res) => {
        if (!res.ok) throw new Error(`orgs/me fetch failed: ${res.status}`);
        return res.json() as Promise<Record<string, { displayName?: string }>>;
      })
      .then((data) => {
        if (cancelled) return;
        const result: Record<string, string> = {};
        for (const [id, org] of Object.entries(data ?? {})) {
          const displayName = org?.displayName?.trim();
          if (displayName) result[id] = displayName;
        }
        setNames(result);
      })
      .catch(() => {
        // Fall back to the token claim's names.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return names;
}
