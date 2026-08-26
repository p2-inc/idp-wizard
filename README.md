> :rocket: **Try it for free** in the Phase Two Enhanced [Keycloak as a service](https://phasetwo.io/?utm_source=github&utm_medium=readme&utm_campaign=idp-wizard).

# Identity Provider and Directory Sync setup wizards for Keycloak

Phase Two SSO and Directory Sync setup wizards for on-prem onboarding and enterprise SaaS self-management. This application uses the [Keycloak Admin API](https://www.keycloak.org/docs-api/24.0.1/rest-api/index.html) and the [Phase Two Organizations API](https://phasetwo.io/api/phase-two-admin-rest-api) to provide wizards for onboarding customer Identity Providers. The goal of these wizards is to solve the complex and error-prone process of connecting a vendor identity system a bit easier, and to avoid exposing customers to the Keycloak UI.

In addition to providing support for Identity Providers using OIDC and SAML, the wizards also supports Directory Synchronization protocols (aka "User Federation" in Keycloak) such as LDAP.

![youtube-video-gif](https://github.com/p2-inc/idp-wizard/assets/244253/e9b421c0-b487-4c07-9eed-87ea89fc574b)

## Repository structure

This is a pnpm workspace monorepo. The frontend apps live under `apps/`, the Java Keycloak SPI extension lives under `ext/`, and the Maven build at the root packages everything into a deployable JAR.

```
idp-wizard/
├── apps/
│   ├── wizard-v1/              # Original PatternFly + webpack app (current production build)
│   └── wizard-v2/              # New Vite + Tailwind + shadcn + TanStack Router app (in development)
│       ├── docker/             # Dev Keycloak setup with pre-configured realm and client
│       ├── public/             # Static assets (favicons, logos, provider images, wizard screenshots)
│       ├── src/                # Application source
│       └── wizards/            # Declarative JSON wizard definitions
├── ext/                        # Java Keycloak SPI extensionprivate static final String ENV_SENDGRID_HAS_CLUSTER_FIELD_ID = "SENDGRID_HAS_CLUSTER_FIELD_ID";

  /**
   * SendGrid custom-field ID (not name) for the {@code has_cluster} attribute used to segment
   * onboarding automations. Fetch from {@code GET /v3/marketing/field_definitions}. When unset, the
   * attribute is not written (the upsert still proceeds without it).
   */
  public static String sendgridHasClusterFieldId() {
    return System.getenv(ENV_SENDGRID_HAS_CLUSTER_FIELD_ID);
  }
├── pom.xml                     # Maven build — packages the active frontend into a Keycloak JAR
└── pnpm-workspace.yaml
```

### wizard-v1

The original implementation. Each identity provider has its own set of per-step React components built on PatternFly 4. This is the currently deployed version.

### wizard-v2

A rewrite in progress. Wizards are defined declaratively as JSON files (see `apps/wizard-v2/wizards/`) and rendered by a generic runtime engine, eliminating the need for per-provider component trees. Built with Vite, Tailwind CSS, shadcn/ui, TanStack Router, and oidc-spa for authentication. See [apps/wizard-v2/README.md](apps/wizard-v2/README.md) for full details.

## Quick start

The easiest way to get started is our [Docker image](https://quay.io/repository/phasetwo/phasetwo-keycloak?tab=info). Documentation and examples for using it are in the [phasetwo-containers](https://github.com/p2-inc/phasetwo-containers) repo. The most recent version of this extension is included.

## Configuration

There are some reasonable defaults used for the configuration, but the behavior of the wizards depends on a few variables, stored as Realm attributes.

| Realm attribute key                             | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_providerConfig.wizard.apiMode`                | `onprem`    | `onprem` or `cloud`. `onprem` uses the Keycloak Admin APIs to set up an Identity Provider, so the user must have the correct `realm-management` roles. `cloud` uses the Phase Two Organizations API, so the user must have membership in an organization with the correct organization roles. A "picker" will be shown to the user if they have both and/or roles in more than one organization. |
| `_providerConfig.wizard.auth-realm-override`    | realm name  | Override the realm used in the generated `keycloak.json`. If unset, the wizard uses the current realm name.                                                                                                                                                                                                                                                                                      |
| `_providerConfig.wizard.emailAsUsername`        | `false`     | When building Identity Provider mappers, should the IdP email address be mapped to the Keycloak `username` field.                                                                                                                                                                                                                                                                                |
| `_providerConfig.wizard.enableDashboard`        | `true`      | Show a minimal dashboard showing the state of the setup.                                                                                                                                                                                                                                                                                                                                         |
| `_providerConfig.wizard.enableDirectorySync`    | `true`      | Show Directory Sync section.                                                                                                                                                                                                                                                                                                                                                                     |
| `_providerConfig.wizard.enableGroupMapping`     | `true`      | Currently does nothing.                                                                                                                                                                                                                                                                                                                                                                          |
| `_providerConfig.wizard.enableIdentityProvider` | `true`      | Show Identity Provider section.                                                                                                                                                                                                                                                                                                                                                                  |
| `_providerConfig.wizard.enableLdap`             | `true`      | Allow LDAP config.                                                                                                                                                                                                                                                                                                                                                                               |
| `_providerConfig.wizard.enableScim`             | `true`      | Allow SCIM config. (not currently used)                                                                                                                                                                                                                                                                                                                                                          |
| `_providerConfig.wizard.trustEmail`             | `false`     | Toggle _trust email_ in the IdP config.                                                                                                                                                                                                                                                                                                                                                          |
| `_providerConfig.wizard.usernameMapperImport`   | `true`      | When building Identity Provider mappers, use `IMPORT` sync mode for the username attribute instead of `INHERIT`.                                                                                                                                                                                                                                                                                 |
| `_providerConfig.wizard.version`                | `v2`        | Which wizard frontend to serve: `v2` (default) or `v1`. Both ship in the JAR, so switching is a realm attribute change rather than a redeploy. Set it to `v1` to opt a realm out of the new wizard. An install-wide default can be set with `--spi-realm-restapi-extension-wizard-default-version`; the realm attribute wins where both are set.                                                    |
| `_providerConfig.assets.logo.url`               | _none_      | URL for logo override. Inherited from `keycloak-orgs` config so we can use the same logo.                                                                                                                                                                                                                                                                                                        |
| `_providerConfig.wizard.appName`                | `Phase Two` | App name to appear in the HTML title.                                                                                                                                                                                                                                                                                                                                                            |

## Choosing a wizard version

Both frontends are built into the same JAR, under `theme/wizard/login/resources/v1` and
`.../v2`, and the extension decides which to serve per request. Nothing about the route,
the `idp-wizard` client, or its redirect URIs changes between them, so upgrading the
extension needs no client or GitOps changes.

Resolution is most specific first:

1. the `_providerConfig.wizard.version` realm attribute, if set;
2. the server default, `--spi-realm-restapi-extension-wizard-default-version=v1|v2`;
3. the built-in default (`v2`).

An unrecognised value logs a warning and falls back rather than failing the request, so a
typo degrades to a working wizard.

To move one realm back to the old wizard:

```sh
# where {realm} is the realm being configured
curl -X PUT "$KC_URL/admin/realms/{realm}" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"attributes": {"_providerConfig.wizard.version": "v1"}}'
```

Unset the attribute to return the realm to the server default.

## Building and installing

This uses the `frontend-maven-plugin` to build **both** frontend apps and packages them as
a single JAR that can be installed as a Keycloak extension. Run `mvn package` from the repo
root, which produces a JAR in `target/`. Place it in the `providers/` directory of your
Keycloak distribution.

Both apps are built on every `mvn package` and land under `theme/wizard/login/resources/v1`
and `.../v2` in the JAR. Which one a realm gets is decided at request time — see
[Choosing a wizard version](#choosing-a-wizard-version).

### Dependencies

This extension depends on 2 other extensions. You must install all of the jars of the other extensions for this to function properly. Please see the documentation in those repos for installation instructions.

- [keycloak-orgs](https://github.com/p2-inc/keycloak-orgs)
- [keycloak-scim](https://github.com/p2-inc/keycloak-scim) (not currently used or required)

> :information_source: How the two wizard versions differ, and how to stage making v2 the default, is documented in [apps/wizard-v2/README.md](apps/wizard-v2/README.md#choosing-between-wizard-v1-and-wizard-v2).

### Compatibility

Although it has been developed and working since Keycloak 14.0.0, the extensions are currently known to work with Keycloak > 23.0.0. Additionally, because of the fast pace of breaking changes since Keycloak "X" (Quarkus version), we don't make any guarantee that this will work with any version other than it is packaged with in the [Docker image](https://quay.io/repository/phasetwo/phasetwo-keycloak?tab=tags).

## Vendors

Wizards are currently available for the following vendors.

| Vendor     | SAML               | OIDC               | LDAP               | SCIM | Other |
| ---------- | ------------------ | ------------------ | ------------------ | ---- | ----- |
| ADFS       | :white_check_mark: |                    |                    |      |       |
| AWS        | :white_check_mark: |                    |                    |      |       |
| Auth0      | :white_check_mark: | :white_check_mark: |                    |      |       |
| Cloudflare | :white_check_mark: |                    |                    |      |       |
| CyberArk   | :white_check_mark: |                    |                    |      |       |
| Duo        | :white_check_mark: |                    |                    |      |       |
| Entra Id   | :white_check_mark: |                    |                    |      |       |
| Generic    | :white_check_mark: | :white_check_mark: | :white_check_mark: |      |       |
| Google     | :white_check_mark: |                    |                    |      |       |
| JumpCloud  | :white_check_mark: |                    |                    |      |       |
| LastPass   | :white_check_mark: |                    |                    |      |       |
| Okta       | :white_check_mark: |                    | :white_check_mark: |      |       |
| OneLogin   | :white_check_mark: |                    |                    |      |       |
| Oracle     | :white_check_mark: |                    |                    |      |       |
| PingOne    | :white_check_mark: |                    |                    |      |       |
| Salesforce | :white_check_mark: | :white_check_mark: |                    |      |       |

## Wizard implementation status (wizard-v2)

The table below tracks the review state of each wizard in the in-development [wizard-v2](apps/wizard-v2/) app. Each wizard is a declarative JSON definition rendered by the generic runtime engine, so "implemented" means a `wizards/{provider}/{protocol}.json` file exists and renders end-to-end.

**Status legend**

| Status                       | Meaning                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| :white_check_mark: Supported    | Reviewed and/or implemented and working.                                                          |
| :hammer_and_wrench: In progress | Wizard actively being built.                                                                      |
| :warning: Experimental          | Implemented but not yet validated — no test account available (invite-only, paid, or region-locked). |
| :white_circle: Not started      | Wizard not yet built.                                                                             |

_Listed roughly in the order they appear in the testing report._

| Provider             | Protocol | Status                          |
| -------------------- | -------- | ------------------------------- |
| LastPass             | SAML     | :white_check_mark: Supported    |
| miniOrange           | SAML     | :white_check_mark: Supported    |
| OneLogin             | SAML     | :white_check_mark: Supported    |
| PingOne              | SAML     | :white_check_mark: Supported    |
| Salesforce           | SAML     | :white_check_mark: Supported    |
| VMware               | SAML     | :white_check_mark: Supported    |
| Xero                 | OAuth    | :white_check_mark: Supported    |
| Google               | SAML     | :white_check_mark: Supported    |
| JumpCloud            | SAML     | :white_check_mark: Supported    |
| GitLab               | OAuth    | :white_check_mark: Supported    |
| Duo                  | SAML     | :white_check_mark: Supported    |
| Google               | OIDC     | :white_check_mark: Supported    |
| Discord              | OAuth    | :white_check_mark: Supported    |
| Okta                 | SAML     | :white_check_mark: Supported    |
| Okta                 | OIDC     | :white_check_mark: Supported    |
| Generic              | SAML     | :white_check_mark: Supported    |
| Slack                | OAuth    | :white_check_mark: Supported    |
| Auth0                | SAML     | :white_check_mark: Supported    |
| Cloudflare           | SAML     | :white_check_mark: Supported    |
| Google               | OAuth    | :white_check_mark: Supported    |
| Vercel Marketplace   | OAuth    | :white_check_mark: Supported    |
| Generic              | OIDC     | :white_check_mark: Supported    |
| Generic              | LDAP     | :white_check_mark: Supported    |
| Generic              | SCIM     | :hammer_and_wrench: In progress |
| GitHub               | OAuth    | :white_check_mark: Supported    |
| Vercel Integration   | OAuth    | :white_check_mark: Supported    |
| Okta                 | LDAP     | :white_check_mark: Supported    |
| Okta                 | SCIM     | :hammer_and_wrench: In progress |
| LinkedIn             | OAuth    | :white_check_mark: Supported    |
| Bitbucket            | OAuth    | :white_check_mark: Supported    |
| CAS                  | SAML     | :white_check_mark: Supported    |
| ClassLink            | SAML     | :white_check_mark: Supported    |
| Clever               | OIDC     | :white_check_mark: Supported    |
| CyberArk             | SAML     | :white_check_mark: Supported    |
| Keycloak             | SAML     | :white_check_mark: Supported    |
| ADFS                 | SAML     | :white_check_mark: Supported    |
| ADP                  | OIDC     | :warning: Experimental          |
| Apple                | OAuth    | :white_check_mark: Supported    |
| Entra ID (Azure)     | SAML     | :white_check_mark: Supported    |
| Entra ID             | OIDC     | :white_check_mark: Supported    |
| Entra ID             | SCIM     | :hammer_and_wrench: In progress |
| Intuit               | OAuth    | :white_check_mark: Supported    |
| Login.gov            | OIDC     | :warning: Experimental          |
| Magic Link           | —        | :white_circle: Not started      |
| Microsoft (social)   | OAuth    | :warning: Experimental          |
| NetIQ                | SAML     | :white_check_mark: Supported    |
| Oracle               | SAML     | :white_check_mark: Supported    |
| PingFederate         | SAML     | :white_check_mark: Supported    |
| Rippling             | SAML     | :warning: Experimental          |
| Shibboleth           | SAML     | :white_check_mark: Supported    |
| SimpleSAMLphp        | SAML     | :white_check_mark: Supported    |
| Salesforce           | OIDC     | :white_check_mark: Supported    |
| AWS                  | SAML     | :white_check_mark: Supported    |

> :bulb: **Microsoft vs. Entra ID:** the **Entra ID** wizards broker enterprise SSO (and SCIM) against an organization's Azure AD / Entra tenant — this is the workforce identity path. **Microsoft (social)** is a separate social-login connector for personal Microsoft accounts (Outlook, Xbox, etc.) using Keycloak's built-in `microsoft` broker. Use Entra ID for enterprise SSO; use Microsoft only if you need consumer Microsoft sign-in.

## Contributing

> :moneybag: :dollar: A $250US bounty will be paid for each complete and accepted vendor wizard that has been labeled with [bounty](https://github.com/p2-inc/idp-wizard/labels/bounty). Please file a PR with your implementation and reference the issue to be considered for the bounty. Acceptance of PRs is at the sole discretion of Phase Two, Inc.

Note: By submitting any code, documentation, or other materials submitted to this repository by pull request, you are immediately granting Phase Two, Inc. the copyright and an exclusive, perpetual, unlimited license to use it in this and any derivative works.

### Working with the code

#### wizard-v1 (current)

Run the Phase Two Keycloak distribution, create a realm, and in the `idp-wizard` client configuration update the redirect URI to `http://localhost:9090/*` and add `http://localhost:9090` to Web Origins. Download the client's `keycloak.json` and place it in `apps/wizard-v1/src/keycloak.json`.

Using the wizard at a different relative path than `/auth`? Update the following:

- `RELATIVE_PATH` within [routes.tsx](./apps/wizard-v1/src/app/routes.tsx)
- `wizard.ftl` ([login](./ext/main/resources/theme/wizard/login/wizard.ftl), [templates](./ext/main/resources/theme-resources/templates/wizard.ftl)) `<base href...`
- [keycloak.json](./apps/wizard-v1/src/keycloak.json) key of `auth-server-url`

```bash
pnpm install
cd apps/wizard-v1
pnpm start:dev
```

To build and test the full JAR-packaged extension in a local container:

```bash
mvn clean package
docker compose up --build
```

#### wizard-v2 (in development)

See [apps/wizard-v2/README.md](apps/wizard-v2/README.md) for full setup instructions.

```bash
cp apps/wizard-v2/.env.local.sample apps/wizard-v2/.env.local
cd apps/wizard-v2/docker && docker compose up
cd apps/wizard-v2 && pnpm dev
```

### Code formatting

The build enforces Google Java formatting standards via [Spotless](https://github.com/diffplug/spotless). Use `mvn spotless:check` to verify formatting and `mvn spotless:apply` to fix it.

To enforce formatting automatically before every push, install the provided git pre-push hook:

```
mvn spotless:install-git-pre-push-hook
```

When you push, the hook runs `spotless:check`. If violations are found, it automatically runs `spotless:apply`, aborts the push, and lets you review and commit the formatted files before retrying.

## License

The extensions herein are used in the [Phase Two](https://phasetwo.io) cloud offering, and are released here as part of its commitment to making its [core extensions](https://phasetwo.io/docs/introduction/open-source) open source. Please consult the [license](COPYING) for information regarding use.

We've changed the license of our core extensions from the AGPL v3 to the [Elastic License v2](https://github.com/elastic/elasticsearch/blob/main/licenses/ELASTIC-LICENSE-2.0.txt).

- Our blog post on the subject https://phasetwo.io/blog/licensing-change/
- An attempt at a clarification https://github.com/p2-inc/keycloak-orgs/issues/81#issuecomment-1554683102

---

All other documentation, source code and other files in this repository are Copyright 2024 Phase Two, Inc.
