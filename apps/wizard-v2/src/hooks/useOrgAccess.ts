import { useEffect, useMemo, useState } from "react";
import { getAccessTokenClaims, useOidc } from "@/oidc";
import { getRuntimeConfig } from "@/runtime-config";
import {
  isEligible,
  listOrgOptions,
  realmIdpAccessFromClaims,
  type OrgClaims,
  type OrgOption,
  type RealmIdpAccess,
} from "@/lib/org-access";

export interface OrgAccess {
  /** Every organization in the ID token's `organizations` claim. */
  orgs: OrgOption[];
  /** Organizations whose identity providers the user can configure. */
  eligibleOrgs: OrgOption[];
  /** Whether the user can configure realm-wide (Global) identity providers. */
  realmAccess: RealmIdpAccess;
}

/** Where the signed-in user may configure identity providers. See `lib/org-access.ts`. */
export function useOrgAccess(): OrgAccess {
  const oidc = useOidc();
  const orgClaims =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((oidc.decodedIdToken as any)?.organizations as OrgClaims | undefined) ??
    undefined;

  const orgs = useMemo(() => listOrgOptions(orgClaims), [orgClaims]);
  const eligibleOrgs = useMemo(() => orgs.filter(isEligible), [orgs]);

  const [realmAccess, setRealmAccess] = useState<RealmIdpAccess>("loading");
  useEffect(() => {
    let cancelled = false;
    const { authRealm, targetRealm } = getRuntimeConfig();
    getAccessTokenClaims()
      .then((claims) => realmIdpAccessFromClaims(claims, authRealm, targetRealm))
      .catch((): RealmIdpAccess => "unknown")
      .then((access) => {
        if (!cancelled) setRealmAccess(access);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { orgs, eligibleOrgs, realmAccess };
}
