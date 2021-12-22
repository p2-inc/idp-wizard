import React, { FC, useState } from "react";
import {
  PageSection,
  PageSectionVariants,
  PageSectionTypes,
  Wizard,
} from "@patternfly/react-core";
import GoogleLogo from "./assets/google_cloud_logo.svg";
import { Header, WizardConfirmation } from "@wizardComponents";
import { Step1, Step2, Step3, Step4, Step5, Step6 } from "./steps";
import { useKeycloakAdminApi } from "@app/hooks/useKeycloakAdminApi";
import axios from "axios";
import { customAlphabet } from "nanoid";
import { alphanumeric } from "nanoid-dictionary";
import IdentityProviderRepresentation from "@keycloak/keycloak-admin-client/lib/defs/identityProviderRepresentation";
import { useHistory } from "react-router";
import { useKeycloak } from "@react-keycloak/web";

const nanoId = customAlphabet(alphanumeric, 6);
interface ConfigData {
  validateSignature: "false" | "true";
  loginHint: "false" | "true";
  signingCertificate: string;
  enabledFromMetadata: "false" | "true";
  postBindingLogout: "false" | "true";
  postBindingResponse: "false" | "true";
  nameIDPolicyFormat: string;
  postBindingAuthnRequest: "false" | "true";
  singleSignOnServiceUrl: string;
  wantAuthnRequestsSigned: "false" | "true";
  addExtensionsElementWithKeyInfo: "false" | "true";
}

export const GoogleWizard: FC = () => {
  const title = "Google wizard";
  const [stepIdReached, setStepIdReached] = useState(1);
  const [kcAdminClient] = useKeycloakAdminApi();
  const { keycloak } = useKeycloak();
  const identifierURL = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/identity-provider/import-config`;
  const [alias, setAlias] = useState(`google-saml-${nanoId()}`);
  const acsUrl = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/broker/${alias}/endpoint`;
  const entityId = `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}`;
  const [configData, setConfigData] = useState<ConfigData | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState("");
  const [error, setError] = useState<null | boolean>(null);
  const [disableButton, setDisableButton] = useState(false);
  const history = useHistory();

  const Axios = axios.create({
    headers: {
      authorization: `bearer ${keycloak.token}`,
    },
  });

  const onNext = (newStep) => {
    if (stepIdReached === 8) {
      history.push("/");
    }
    setStepIdReached(stepIdReached < newStep.id ? newStep.id : stepIdReached);
  };

  const closeWizard = () => {
    history.push("/");
  };

  const uploadMetadataFile = async (file: File) => {
    const fd = new FormData();
    fd.append("providerId", "saml");
    fd.append("file", file);

    try {
      const resp = await Axios.post(identifierURL, fd);

      if (resp.status === 200) {
        setConfigData(resp.data);
        return true;
      }
    } catch (err) {
      console.log(err);
    }

    return false;
  };

  const createGoogleIdp = async () => {
    setIsValidating(true);
    setResults("Creating SAML IdP...");

    const payload: IdentityProviderRepresentation = {
      alias: alias,
      displayName: "Google SAML Single Sign-on",
      providerId: "saml",
      config: configData!,
    };

    try {
      await kcAdminClient.identityProviders.create({
        ...payload,
        realm: process.env.REALM!,
      });
      setResults("Google IdP created successfully. Click finish.");
      setStepIdReached(8);
      setError(false);
      setDisableButton(true);
    } catch (e) {
      setResults("Error creating IdP for Google SAML.");
      setError(true);
    } finally {
      setIsValidating(false);
    }
  };

  const steps = [
    {
      id: 1,
      name: "Add Custom SAML Application",
      component: <Step1 />,
      hideCancelButton: true,
    },
    {
      id: 2,
      name: "Enter Details for your Custom App",
      component: <Step2 />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 2,
    },
    {
      id: 3,
      name: "Upload Google IdP Information",
      component: <Step3 uploadMetadataFile={uploadMetadataFile} />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 3,
      enableNext: configData !== null,
    },
    {
      id: 4,
      name: "Enter Service Provider Details",
      component: <Step4 acsUrl={acsUrl} entityId={entityId} />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 4,
    },
    {
      id: 5,
      name: "Configure Attribute Mapping",
      component: <Step5 />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 5,
    },
    {
      id: 6,
      name: "Configure User Access",
      component: <Step6 />,
      hideCancelButton: true,
      canJumpTo: stepIdReached >= 6,
    },
    {
      id: 7,
      name: "Confirmation",
      component: (
        <WizardConfirmation
          title="SSO Configuration Complete"
          message="Your users can now sign-in with Google Cloud SAML."
          buttonText="Create SAML IdP in Keycloak"
          disableButton={disableButton}
          resultsText={results}
          error={error}
          isValidating={isValidating}
          validationFunction={createGoogleIdp}
        />
      ),
      nextButtonText: "Finish",
      hideCancelButton: true,
      enableNext: stepIdReached === 8,
      canJumpTo: stepIdReached >= 7,
    },
  ];

  return (
    <>
      <Header logo={GoogleLogo} />
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
