import React, { FC, useState } from "react";
import {
  PageSection,
  PageSectionVariants,
  PageSectionTypes,
  Wizard,
} from "@patternfly/react-core";
import GoogleLogo from "@app/images/provider-logos/google_saml_logo.png";
import { Header, WizardConfirmation } from "@wizardComponents";
import { Step1 } from "./steps";
import { useKeycloakAdminApi } from "@app/hooks/useKeycloakAdminApi";
import axios from "axios";
import { useHistory } from "react-router";
import { useKeycloak } from "@react-keycloak/web";

export const GenericLDAP: FC = () => {
  const title = "Okta wizard";
  const [stepIdReached, setStepIdReached] = useState(1);
  const [kcAdminClient] = useKeycloakAdminApi();
  const { keycloak } = useKeycloak();
  const history = useHistory();

  // Complete
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState("");
  const [error, setError] = useState(null);
  const [disableButton, setDisableButton] = useState(false);

  const Axios = axios.create({
    headers: {
      authorization: `bearer ${keycloak.token}`,
    },
  });

  const onNext = (newStep) => {
    if (stepIdReached === steps.length + 1) {
      history.push("/");
    }
    setStepIdReached(stepIdReached < newStep.id ? newStep.id : stepIdReached);
  };

  const closeWizard = () => {
    history.push("/");
  };

  const validateFn = () => {
    // On final validation set stepIdReached to steps.length+1
    console.log("validated!");
  };

  const steps = [
    {
      id: 1,
      name: "Step1 Title",
      component: <Step1 />,
      hideCancelButton: true,
    },
    {
      id: 2,
      name: "Confirmation",
      component: (
        <WizardConfirmation
          title="SSO Configuration Complete"
          message="Your users can now sign-in with {{Provider}}."
          buttonText="Create {{Provider}} IdP in Keycloak"
          disableButton={disableButton}
          resultsText={results}
          error={error}
          isValidating={isValidating}
          validationFunction={validateFn}
        />
      ),
      nextButtonText: "Finish",
      hideCancelButton: true,
      enableNext: stepIdReached === 3,
      canJumpTo: stepIdReached >= 2,
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
