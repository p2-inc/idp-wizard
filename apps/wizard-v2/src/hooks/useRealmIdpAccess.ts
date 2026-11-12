import { useEffect, useState } from "react";
import { decodeJwt } from "oidc-spa/decode-jwt";
import { getOidc, useOidc } from "@/oidc";
import { getRuntimeConfig } from "@/runtime-config";
import { hasRealmIdpRoles, type ResourceAccess } from "@/lib/org-access";

/**
 * Whether the signed-in user holds the realm-management IdP roles needed for
 * Global (realm-wide) mode.
 *
 * Keycloak puts client roles in the access token's `resource_access` claim (and in the
 * ID token only when a mapper is configured to), so both are checked. Returns null
 * until the access token has been read.
 */
export function useRealmIdpAccess(): boolean | null {
  const oidc = useOidc();
  const idTokenResourceAccess = (
    oidc.decodedIdToken as { resource_access?: ResourceAccess } | undefined
  )?.resource_access;

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { authRealm, targetRealm } = getRuntimeConfig();

    (async () => {
      let accessTokenResourceAccess: ResourceAccess | undefined;
      try {
        const loggedIn = await getOidc();
        if (loggedIn.isUserLoggedIn) {
          accessTokenResourceAccess = decodeJwt<{
            resource_access?: ResourceAccess;
          }>(await loggedIn.getAccessToken()).resource_access;
        }
      } catch {
        // Opaque or undecodable token (e.g. the mock adapter) — fall back to the ID token.
      }
      if (!cancelled) {
        setHasAccess(
          hasRealmIdpRoles(
            [accessTokenResourceAccess, idTokenResourceAccess],
            authRealm,
            targetRealm,
          ),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idTokenResourceAccess]);

  return hasAccess;
}
