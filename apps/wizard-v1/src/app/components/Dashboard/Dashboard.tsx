import { useApi, useOrganization, useRoleAccess } from "@app/hooks";
import { usePageTitle } from "@app/hooks/useTitle";
import { useGetFeatureFlagsQuery } from "@app/services";
import Loading from "@app/utils/Loading";
import {
  Flex,
  FlexItem,
  PageSection,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import React, { useEffect, useState } from "react";
import { MainNav } from "../navigation";
import { ActivityLog } from "./ActivityLog";
import { ConnectionStatus } from "./ConnectionStatus";
import { DashboardSummary } from "./DashboardSummary";
import { Axios } from "../IdentityProviderWizard/Wizards/services";

const Dashboard: React.FunctionComponent = () => {
  usePageTitle("Dashboard");
  const { navigateToAccessDenied } = useRoleAccess();
  const { data: featureFlags, isLoading: isLoadingFeatureFlags } =
    useGetFeatureFlagsQuery();

  const [userOrgs, setUserOrgs] = useState(null);
  const { orgsUrl } = useApi();

  const { getCurrentOrgName, currentOrg } = useOrganization();
  const currentOrgDetails = userOrgs?.find((org) => org.id === currentOrg);
  const currentOrgName =
    currentOrgDetails?.displayName ||
    currentOrgDetails?.name ||
    getCurrentOrgName();

  const fetchOrgs = async () => {
    if (getCurrentOrgName() === "Global") return;

    try {
      const resp = await Axios.get(orgsUrl);
      if (resp.status !== 200) {
        throw new Error(`Error fetching organizations: ${resp.statusText}`);
      }
      setUserOrgs(resp.data);
    } catch (e) {
      console.error("Error fetching organizations:", e);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [currentOrg]);

  if (isLoadingFeatureFlags) {
    return <Loading />;
  } else {
    if (!featureFlags?.enableDashboard) {
      navigateToAccessDenied();
      return <Loading />;
    }
  }

  return (
    <PageSection>
      <Stack hasGutter>
        <StackItem>
          <MainNav title="Dashboard" orgName={currentOrgName} />
        </StackItem>
        <StackItem>
          <Flex>
            <FlexItem flex={{ default: "flex_2" }}>
              <DashboardSummary />
            </FlexItem>
            <FlexItem flex={{ default: "flex_2" }}>
              <ConnectionStatus />
            </FlexItem>
          </Flex>
        </StackItem>
        <StackItem isFilled>
          <Flex>
            <FlexItem flex={{ default: "flex_1" }}>
              <ActivityLog />
            </FlexItem>
          </Flex>
        </StackItem>
      </Stack>
    </PageSection>
  );
};

export { Dashboard };
