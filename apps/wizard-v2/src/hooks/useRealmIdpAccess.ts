import { useEffect, useState } from "react";
import { decodeJwt } from "oidc-spa/decode-jwt";
import { getOidc, useOidc } from "@/oidc";
import { getRuntimeConfig } from "@/runtime-config";
import {
  realmIdpAccess,
  type RealmIdpAccess,
  type ResourceAccess,
} from "@/lib/org-access";

/**
 * Whether the signed-in user holds the realm-management IdP roles needed for
 * Global (realm-wide) mode. See `realmIdpAccess` in `lib/org-access.ts`.
 *
 * Keycloak puts client roles in the access token's `resource_access` claim (and in the
 * ID token only when a mapper is configured to), so both are checked. `"loading"` until
 * the access token has been read; `"unknown"` when neither token says anything.
 */
export function useRealmIdpAccess(): RealmIdpAccess {
  const oidc = useOidc();
  const idTokenResourceAccess = (
    oidc.decodedIdToken as { resource_access?: ResourceAccess } | undefined
  )?.resource_access;

  const [access, setAccess] = useState<RealmIdpAccess>("loading");

  useEffect(() => {
    let cancelled = false;
    const { authRealm, targetRealm } = getRuntimeConfig();

    (async () => {
      // undefined = the access token couldn't be read; {} = read, but no client roles.
      let accessTokenResourceAccess: ResourceAccess | undefined;
      try {
        const loggedIn = await getOidc();
        if (loggedIn.isUserLoggedIn) {
          accessTokenResourceAccess =
            decodeJwt<{ resource_access?: ResourceAccess }>(
              await loggedIn.getAccessToken(),
            ).resource_access ?? {};
        }
      } catch {
        // Opaque or undecodable token (e.g. the mock adapter) — rely on the ID token.
      }
      if (!cancelled) {
        setAccess(
          realmIdpAccess(
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

  return access;
}
