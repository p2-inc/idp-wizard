import type { FullConfig } from "@playwright/test";

/**
 * Global setup — runs once before all integration tests (after auth:setup).
 *
 * Creates test organizations in the wizard realm via the Phase Two Orgs API and
 * assigns test users to them. These organizations are used by the organizations
 * spec and by wizard-completion tests that test the org-scoped (cloud) flow.
 *
 * Organizations created:
 *   - test-org-alpha  → org-admin as admin, org-member as member
 *   - test-org-beta   → no members (used for isolation tests)
 *
 * The org IDs are written to process.env so tests can reference them without
 * hardcoding. Playwright passes env through to workers automatically.
 *
 * Only runs when PLAYWRIGHT_INTEGRATION=true (see playwright.config.ts).
 */

const KC_BASE = process.env.KC_BASE_URL ?? "http://localhost:8080/auth";
const REALM = "wizard";
const ADMIN_USER = process.env.KC_ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.KC_ADMIN_PASS ?? "admin";

async function getAdminToken(): Promise<string> {
  const res = await fetch(
    `${KC_BASE}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "admin-cli",
        username: ADMIN_USER,
        password: ADMIN_PASS,
        grant_type: "password",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to get admin token: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function getUserId(token: string, username: string): Promise<string | null> {
  const res = await fetch(
    `${KC_BASE}/admin/realms/${REALM}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const users = (await res.json()) as Array<{ id: string; username: string }>;
  return users[0]?.id ?? null;
}

async function createOrg(
  token: string,
  name: string,
  displayName: string
): Promise<string | null> {
  // Check if org already exists
  const listRes = await fetch(
    `${KC_BASE}/realms/${REALM}/orgs?search=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (listRes.ok) {
    const existing = (await listRes.json()) as Array<{ id: string; name: string }>;
    const match = existing.find((o) => o.name === name);
    if (match) {
      console.log(`[global-setup] org "${name}" already exists (${match.id})`);
      return match.id;
    }
  }

  const res = await fetch(`${KC_BASE}/realms/${REALM}/orgs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, displayName }),
  });

  if (!res.ok) {
    console.warn(`[global-setup] failed to create org "${name}": ${res.status} ${await res.text()}`);
    return null;
  }

  // Phase Two returns the created org in the Location header or body
  const location = res.headers.get("location");
  if (location) {
    const id = location.split("/").pop() ?? null;
    console.log(`[global-setup] created org "${name}" → ${id}`);
    return id;
  }

  // Fallback: re-fetch to get the id
  const refetch = await fetch(
    `${KC_BASE}/realms/${REALM}/orgs?search=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (refetch.ok) {
    const orgs = (await refetch.json()) as Array<{ id: string; name: string }>;
    return orgs.find((o) => o.name === name)?.id ?? null;
  }
  return null;
}

async function addOrgMember(token: string, orgId: string, userId: string) {
  const res = await fetch(
    `${KC_BASE}/realms/${REALM}/orgs/${orgId}/members/${userId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 409) {
    console.warn(
      `[global-setup] failed to add member ${userId} to org ${orgId}: ${res.status}`
    );
  }
}

async function grantOrgRole(
  token: string,
  orgId: string,
  userId: string,
  roleName: string
) {
  // Get the org role id
  const rolesRes = await fetch(
    `${KC_BASE}/realms/${REALM}/orgs/${orgId}/roles`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!rolesRes.ok) return;

  const roles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
  const role = roles.find((r) => r.name === roleName);
  if (!role) return;

  await fetch(
    `${KC_BASE}/realms/${REALM}/orgs/${orgId}/members/${userId}/roles`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    }
  );
}

export default async function globalSetup(_config: FullConfig) {
  console.log("[global-setup] starting organization setup...");

  const token = await getAdminToken();

  const [orgAdminId, orgMemberId] = await Promise.all([
    getUserId(token, "org-admin"),
    getUserId(token, "org-member"),
  ]);

  if (!orgAdminId) {
    console.warn("[global-setup] org-admin user not found — skipping org setup");
    return;
  }

  // Create test organizations
  const [alphaId, betaId] = await Promise.all([
    createOrg(token, "test-org-alpha", "Alpha Test Organization"),
    createOrg(token, "test-org-beta", "Beta Test Organization"),
  ]);

  if (alphaId) {
    // Assign org-admin as member + admin of alpha org
    await addOrgMember(token, alphaId, orgAdminId);
    await grantOrgRole(token, alphaId, orgAdminId, "admin");

    if (orgMemberId) {
      await addOrgMember(token, alphaId, orgMemberId);
    }

    // Expose org IDs to tests via env
    process.env.TEST_ORG_ALPHA_ID = alphaId;
    console.log(`[global-setup] test-org-alpha ready: ${alphaId}`);
  }

  if (betaId) {
    process.env.TEST_ORG_BETA_ID = betaId;
    console.log(`[global-setup] test-org-beta ready: ${betaId}`);
  }

  console.log("[global-setup] done");
}
