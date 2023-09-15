> :rocket: **Try it for free** in the Phase Two Enhanced [Keycloak as a service](https://phasetwo.io/?utm_source=github&utm_medium=readme&utm_campaign=idp-wizard). 

# SSO and Directory Sync setup wizards for Keycloak

Phase Two SSO and Directory Sync setup wizards for on-prem onboarding and enterprise SaaS self-management. This application uses the [Keycloak Admin API](https://www.keycloak.org/docs-api/22.0.3/rest-api/index.html) and the [Phase Two Organizations API](https://phasetwo.io/api/phase-two-admin-rest-api) to provide wizards for onboarding customer Identity Providers. The goal of these wizards is to solve the complex and error-prone process of connecting a vendor identity system a bit easier, and to avoid exposing customers to the Keycloak UI.

In addition to providing support for Identity Providers using OIDC and SAML, the wizards also supports Directory Synchronization protocols (aka "User Federation" in Keycloak) such as LDAP and SCIM.

TODO demo gif

## Quick start

The easiest way to get started is our [Docker image](https://quay.io/repository/phasetwo/phasetwo-keycloak?tab=info). Documentation and examples for using it are in the [phasetwo-containers](https://github.com/p2-inc/phasetwo-containers) repo. The most recent version of this extension is included.

## Configuration

There are some reasonable defaults used for the configuration, but the behavior of the wizards depends on a few variables, stored as Realm attributes.

| Realm attribute key | Default | Description |
| --- | --- | --- |
| `_providerConfig.wizard.apiMode` | `onprem` | `onprem` or `cloud`. `onprem` uses the Keycloak Admin APIs to set up an Identity Provider, so the user must have the correct `realm-management` roles. `cloud` uses the Phase Two Organizations API, so the user must have membership in an organization with the correct organization roles. A "picker" will be shown to the user if they have both and/or roles in more than one organization. |
| `_providerConfig.wizard.emailAsUsername` | `false` | When building Identity Provider mappers, should the IdP email address be mapped to the Keycloak `username` field. |
| `_providerConfig.wizard.enableDashboard` | `true` | Show a minimal dashboard showing the state of the setup. |
| `_providerConfig.wizard.enableDirectorySync` | `true` | Show Directory Sync section. |
| `_providerConfig.wizard.enableGroupMapping` | `true` | Currently does nothing. |
| `_providerConfig.wizard.enableIdentityProvider` | `true` | Show Identity Provider section. |
| `_providerConfig.wizard.enableLdap` | `true` | Allow LDAP config. |
| `_providerConfig.wizard.enableScim` | `true` | Allow SCIM config. |
| `_providerConfig.wizard.trustEmail` | `false` | Toggle *trust email* in the IdP config. |
| `_providerConfig.assets.logo.url` | *none* | URL for logo override. Inherited from `keycloak-orgs` config so we can use the same logo. |

## Building and installing

This uses the `frontend-maven-plugin` to build UI code and then packages it as a jar file that can be installed as an extension in Keycloak. Checkout this project and run `mvn package`, which will produce a jar in the `target/` directory. Place the jar in the `providers` dir of your Keycloak distribution.

### Dependencies

This extension depends on 2 other extensions. You must install all of the jars of the other extensions for this to function properly. Please see the documentation in those repos for installation instructions.
- [keycloak-orgs](https://github.com/p2-inc/keycloak-orgs)
- [keycloak-scim](https://github.com/p2-inc/keycloak-scim)

### Compatibility

Although it has been developed and working since Keycloak 14.0.0, the extensions are currently known to work with Keycloak > 22.0.0. Additionally, because of the fast pace of breaking changes since Keycloak "X" (Quarkus version), we don't make any guarantee that this will work with any version other than it is packaged with in the [Docker image](https://quay.io/repository/phasetwo/phasetwo-keycloak?tab=tags).

## Vendors

Wizards are currently available for the following vendors.

| Vendor | SAML | OIDC | LDAP | SCIM | Other |
| --- | --- | --- | --- | --- | --- |
| ADFS | :white_check_mark: |  | :white_check_mark: |  |  |
| AWS | :white_check_mark: |  |  |  |  |
| Auth0 | :white_check_mark: | :white_check_mark: |  |  |  |
| Azure | :white_check_mark: |  |  |  |  |
| Duo | :white_check_mark: |  |  |  |  |
| Generic | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |  |
| Google | :white_check_mark: |  |  |  |  |
| JumpCloud | :white_check_mark: |  |  |  |  |
| Okta | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |  |
| OneLogin | :white_check_mark: |  |  |  |  |
| PingOne | :white_check_mark: |  |  |  |  |

## Contributing

> :moneybag: :dollar: A $250US bounty will be paid for each complete and accepted vendor wizard that has been labeled with [bounty](https://github.com/p2-inc/idp-wizard/labels/bounty).
 
### Working with the code

```bash
git clone https://github.com/p2-inc/idp-wizard
cd idp-wizard
npm install --legacy-peer-deps && npm run start:dev
```

### Development scripts
```sh
# Install development/build dependencies
npm install --legacy-peer-deps

# Start the development server
npm run start:dev

# Run a production build (outputs to "dist" dir)
npm run build

# Run the test suite
npm run test

# Run the test suite with coverage
npm run test:coverage

# Run the linter
npm run lint

# Run the code formatter
npm run format

# Launch a tool to inspect the bundle size
npm run bundle-profile:analyze

# Start the express server (run a production build first)
npm run start

# Start storybook component explorer
npm run storybook

# Build storybook component explorer as standalone app (outputs to "storybook-static" dir)
npm run build:storybook
```

### Configurations
* [TypeScript Config](./tsconfig.json)
* [Webpack Config](./webpack.common.js)
* [Jest Config](./jest.config.js)
* [Editor Config](./.editorconfig)

### Raster image support

To use an image asset that's shipped with PatternFly core, you'll prefix the paths with "@assets". `@assets` is an alias for the PatternFly assets directory in node_modules.

For example:
```js
import imgSrc from '@assets/images/g_sizing.png';
<img src={imgSrc} alt="Some image" />
```

You can use a similar technique to import assets from your local app, just prefix the paths with "@app". `@app` is an alias for the main src/app directory.

```js
import loader from '@app/assets/images/loader.gif';
<img src={loader} alt="Content loading />
```

### Vector image support
Inlining SVG in the app's markup is also possible.

```js
import logo from '@app/assets/images/logo.svg';
<span dangerouslySetInnerHTML={{__html: logo}} />
```

You can also use SVG when applying background images with CSS. To do this, your SVG's must live under a `bgimages` directory (this directory name is configurable in [webpack.common.js](./webpack.common.js#L5)). This is necessary because you may need to use SVG's in several other context (inline images, fonts, icons, etc.) and so we need to be able to differentiate between these usages so the appropriate loader is invoked.
```css
body {
  background: url(./assets/bgimages/img_avatar.svg);
}
```

### Adding custom CSS
When importing CSS from a third-party package for the first time, you may encounter the error `Module parse failed: Unexpected token... You may need an appropriate loader to handle this file typ...`. You need to register the path to the stylesheet directory in [stylePaths.js](./stylePaths.js). We specify these explicity for performance reasons to avoid webpack needing to crawl through the entire node_modules directory when parsing CSS modules.

### Code quality tools
* For accessibility compliance, we use [react-axe](https://github.com/dequelabs/react-axe)
* To keep our bundle size in check, we use [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
* To keep our code formatting in check, we use [prettier](https://github.com/prettier/prettier)
* To keep our code logic and test coverage in check, we use [jest](https://github.com/facebook/jest)
* To ensure code styles remain consistent, we use [eslint](https://eslint.org/)
* To provide a place to showcase custom components, we integrate with [storybook](https://storybook.js.org/)

### Multi environment configuration
This project uses [dotenv-webpack](https://www.npmjs.com/package/dotenv-webpack) for exposing environment variables to your code. Either export them at the system level like `export MY_ENV_VAR=http://dev.myendpoint.com && npm run start:dev` or simply drop a `.env` file in the root that contains your key-value pairs like below:

```sh
ENV_1=http://1.myendpoint.com
ENV_2=http://2.myendpoint.com
```

With that in place, you can use the values in your code like `console.log(process.env.ENV_1);`
