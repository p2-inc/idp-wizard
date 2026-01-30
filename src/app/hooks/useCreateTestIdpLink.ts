import { useApi } from "./useApi";
import { Axios } from "@app/components/IdentityProviderWizard/Wizards/services";
import { Protocols } from "@app/configurations";
import { useKeycloakAdminApi } from "./useKeycloakAdminApi";

export function useCreateTestIdpLink() {
  const { baseServerRealmsUrl, endpoints } = useApi();
  const { getRealm } = useKeycloakAdminApi();
  const realm = getRealm();

  const fetchIdpDetails = async (alias) => {
    try {
      const resp = await Axios.get(
        `${baseServerRealmsUrl}/${endpoints?.getIdPs.endpoint}/${alias}`,
      );
      if (resp.status === 200) {
        return resp.data;
      }
    } catch (e) {
      console.error("Error fetching identity provider details:", e);
    }
  };

  const isValidationPendingForAlias = async (
    alias: string,
    protocol: Protocols,
  ) => {
    const idpDetails = await fetchIdpDetails(alias);

    if (idpDetails && idpDetails.config.validationPending === "true") {
      const tryIdpLink = `${baseServerRealmsUrl}/${realm}/protocol/${protocol.toLowerCase()}/auth?client_id=idp-tester&redirect_uri=${
        window.location.href
      }&response_type=code&scope=openid&kc_idp_hint=${alias}`;
      return tryIdpLink;
    }

    return null;
  };

  return { isValidationPendingForAlias };
}
