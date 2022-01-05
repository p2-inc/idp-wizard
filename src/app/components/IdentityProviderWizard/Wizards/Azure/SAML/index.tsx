import React, { FC, useState } from "react";
import {
  PageSection,
  PageSectionVariants,
  PageSectionTypes,
  Wizard,
} from "@patternfly/react-core";
import * as Steps from "./Steps";
import azureLogo from "@app/images/azure/azure-logo.png";
import { WizardConfirmation, Header } from "@wizardComponents";
import { useHistory } from "react-router-dom";
import { useKeycloakAdminApi } from "@app/hooks/useKeycloakAdminApi";
import { API_STATUS } from "@app/configurations/api-status";
import IdentityProviderRepresentation from "@keycloak/keycloak-admin-client/lib/defs/identityProviderRepresentation";

export const AzureWizard: FC = () => {
  const [stepIdReached, setStepIdReached] = useState(1);
  const [results, setResults] = useState("");
  const [error, setError] = useState<null | boolean>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const history = useHistory();
  const [kcAdminClient] = useKeycloakAdminApi();
  const [metadata, setMetadata] = useState();
  const [metadataUrl, setMetadataUrl] = useState("");

  const onNext = (newStep) => {
    if (stepIdReached === steps.length + 1) {
      history.push("/");
    }
    setStepIdReached(stepIdReached < newStep.id ? newStep.id : stepIdReached);
  };

  const closeWizard = () => {
    history.push("/");
  };

  const validateMetadata = async ({ metadataUrl }: { metadataUrl: string }) => {
    // make call to submit the URL and verify it
    setMetadataUrl(metadataUrl);

    try {
      const resp = await kcAdminClient.identityProviders.importFromUrl({
        fromUrl: metadataUrl,
        providerId: "saml",
        realm: process.env.REALM,
      });

      setMetadata(resp);
      setIsFormValid(true);

      return {
        status: API_STATUS.SUCCESS,
        message:
          "Configuration successfully validated with Azure. Continue to next step.",
      };
    } catch (e) {
      return {
        status: API_STATUS.ERROR,
        message:
          "Configuration validation failed with Azure. Check URL and try again.",
      };
    }
  };

  const createAzureSamlIdP = async () => {
    // On final validation set stepIdReached to steps.length+1
    setIsValidating(true);
    setDisableButton(false);
    setResults("Creating Okta SAML IdP...");

    const payload: IdentityProviderRepresentation = {
      alias: "azure-saml",
      displayName: `Azure SAML Single Sign-on`,
      providerId: "saml",
      config: metadata!,
    };

    try {
      await kcAdminClient.identityProviders.create({
        ...payload,
        realm: process.env.REALM!,
      });

      setResults("Azure SAML IdP created successfully. Click finish.");
      setStepIdReached(7);
      setError(false);
      setDisableButton(true);
    } catch (e) {
      setResults(
        "Error creating Azure SAML IdP. Please confirm there is no Azure SAML configured already."
      );
      setError(true);
    } finally {
      setIsValidating(false);
    }
  };

  const steps = [
    {
      id: 1,
      name: "Create Enterprise Application",
      component: <Steps.AzureStepOne />,
      hideCancelButton: true,
    },
    {
      id: 2,
      name: "Configure Attribute Statements",
      component: <Steps.AzureStepTwo />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 2,
    },
    {
      id: 3,
      name: "Upload Azure SAML Metadata file",
      component: <Steps.AzureStepThree validateMetadata={validateMetadata} />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 3,
      enableNext: isFormValid,
    },
    {
      id: 4,
      name: "User Attributes & Claims",
      component: <Steps.AzureStepFour />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 4,
    },
    {
      id: 5,
      name: "Assign People & Groups",
      component: <Steps.AzureStepFive />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 5,
    },
    {
      name: "Confirmation",
      component: (
        <WizardConfirmation
          title="SSO Configuration Complete"
          message="Your users can now sign-in with Azure AD."
          buttonText="Create SAML IdP in Keycloak"
          resultsText={results}
          error={error}
          isValidating={isValidating}
          validationFunction={createAzureSamlIdP}
          disableButton={disableButton}
        />
      ),
      nextButtonText: "Finish",
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 6,
      enableNext: stepIdReached === 7,
    },
  ];

  const title = "Azure wizard";

  return (
    <>
      <Header logo={azureLogo} />
      <PageSection
        type={PageSectionTypes.wizard}
        variant={PageSectionVariants.light}
      >
        <Wizard
          navAriaLabel={`${title} steps`}
          isNavExpandable
          mainAriaLabel={`${title} content`}
          onClose={closeWizard}
          nextButtonText="Continue to Next Step"
          steps={steps}
          height="100%"
          width="100%"
          onNext={onNext}
        />
      </PageSection>
    </>
  );
};