import React from "react";
import ReactDOM from "react-dom";
import App from "@app/index";
import { store } from "@app/store";
import { Provider as ReduxProvider } from "react-redux";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./keycloak";
import Loading from "@app/utils/Loading";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
let persistor = persistStore(store);
import { Toaster } from "react-hot-toast";
import { stripOidcParamsFromLocation } from "@app/utils/oidc-params";

if (process.env.NODE_ENV !== "production") {
  const config = {
    rules: [
      {
        id: "color-contrast",
        enabled: false,
      },
    ],
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
  const axe = require("react-axe");
  axe(React, ReactDOM, 1000, config);
}

// Must run before keycloak-js initializes: it defaults `redirect_uri` to
// window.location.href, and Keycloak rejects that URL outright if it still
// carries an OIDC response (as it does when arriving via a portal link).
const redirectUri = stripOidcParamsFromLocation();

ReactDOM.render(
  <ReactKeycloakProvider
    authClient={keycloak}
    initOptions={{
      onLoad: "login-required",
      redirectUri,
      silentCheckSsoRedirectUri:
        window.location.origin + "/silent-check-sso.html",
    }}
    LoadingComponent={<Loading />}
  >
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
        <Toaster />
      </PersistGate>
    </ReduxProvider>
  </ReactKeycloakProvider>,
  document.getElementById("root") as HTMLElement,
);
