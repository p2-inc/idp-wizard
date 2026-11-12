import { useMemo } from "react";
import { useOidc } from "@/oidc";
import { useRealmIdpAccess } from "@/hooks/useRealmIdpAccess";
import {
  isEligible,
  listOrgOptions,
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
  const orgClaims = (
    oidc.decodedIdToken as { organizations?: OrgClaims } | undefined
  )?.organizations;

  const orgs = useMemo(() => listOrgOptions(orgClaims), [orgClaims]);
  const eligibleOrgs = useMemo(() => orgs.filter(isEligible), [orgs]);
  const realmAccess = useRealmIdpAccess();

  return { orgs, eligibleOrgs, realmAccess };
}
