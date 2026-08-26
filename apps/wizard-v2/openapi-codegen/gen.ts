/**
 * Generates TypeScript types from OpenAPI specs into src/api/types/.
 * Run with: pnpm gen-api
 *
 * Two specs:
 *   - Phase Two Orgs API  → types/orgs.d.ts  (org-scoped IDP endpoints)
 *   - Keycloak Admin API  → types/admin.d.ts  (realm-wide IDP endpoints)
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../src/api/types");

const specs = [
  {
    name: "orgs",
    url: "https://raw.githubusercontent.com/p2-inc/phasetwo-docs/main/openapi.yaml",
    out: `${outDir}/orgs.d.ts`,
  },
  {
    name: "admin",
    url: "https://www.keycloak.org/docs-api/latest/rest-api/openapi.json",
    out: `${outDir}/admin.d.ts`,
  },
];

for (const spec of specs) {
  console.log(`Generating ${spec.name} types from ${spec.url}...`);
  const { stdout, stderr } = await run(
    `npx openapi-typescript "${spec.url}" -o "${spec.out}"`,
  );
  if (stdout) console.log(stdout);
  if (stderr && !stderr.includes("ExperimentalWarning")) console.error(stderr);
  console.log(`  ✓ ${spec.out}`);
}

console.log("Done.");
