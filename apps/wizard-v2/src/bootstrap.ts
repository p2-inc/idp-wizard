import { oidcEarlyInit } from "oidc-spa/entrypoint";
import { browserRuntimeFreeze } from "oidc-spa/browser-runtime-freeze";
import { getBasepath } from "./runtime-config";

const { shouldLoadApp } = oidcEarlyInit({
  BASE_URL: getBasepath(),
  securityDefenses: {
    ...browserRuntimeFreeze(),
  },
});

if (shouldLoadApp) {
  import("./main");
}
