import { useTitle } from "react-use";
import { useGetFeatureFlagsQuery } from "@app/services";
import keycloak from "../../keycloak";
import { startCase } from "lodash";

export const usePageTitle = (title?: string) => {
  const { data: featureFlags } = useGetFeatureFlagsQuery();
  const appName = featureFlags?.appName;
  const realmName = featureFlags?.displayName || startCase(keycloak.realm);

  const setPageTitle = (pageTitle: string) => {
    const parts = [pageTitle];

    if (appName) {
      parts.push(appName);
    } else if (realmName) {
      parts.push(realmName);
    }

    useTitle(parts.join(" | "));
  };

  // Set initial title if provided
  if (title) {
    setPageTitle(title);
  }

  return { setPageTitle };
};
