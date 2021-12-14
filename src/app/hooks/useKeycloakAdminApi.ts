import KcAdminClient from "@keycloak/keycloak-admin-client";
import { GrantTypes } from "@keycloak/keycloak-admin-client/lib/utils/auth";

const settings = {
    baseUrl: process.env.KEYCLOAK_URL,
    realmName: process.env.REALM,
    // requestConfig: {
    //   /* Axios request config options https://github.com/axios/axios#request-config */
    // },
  };

  const credentials = {
    grantType: "client_credentials" as GrantTypes,
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '    ',
  };

  export const useKeycloakAdminApi = () => {
  
    const kcAdminClient = new KcAdminClient(settings);
    //TODO: Do not create a new token for each request. 
    const setKcAdminClientAccessToken = async () => {
      console.log("setting keycloak token")
      await SetAccessToken();
      console.log("set")

        async function SetAccessToken() {
          console.log(credentials.grantType)
          console.log(credentials.clientId)
          console.log(credentials.clientSecret)
          await kcAdminClient.auth(credentials);
        }
    }
    return [kcAdminClient, setKcAdminClientAccessToken] as const;
};
