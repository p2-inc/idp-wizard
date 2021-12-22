import { Button, Stack, StackItem, Title } from "@patternfly/react-core";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@patternfly/react-icons";
import React, { FC } from "react";

interface SuccessProps {
  title: string;
  message: string;
  buttonText: string;
  resultsText: string;
  error: boolean | null;
  isValidating: boolean;
  disableButton: boolean;
  validationFunction: () => void;
}

// States should be
// On component => no submission yet. Tell user to finalize by creating instance in Keycloak
// On component, submitted with success => redirect to dashboard
// On component, submitted with error => show an error occurred and to review configuration

export const WizardConfirmation: FC<SuccessProps> = ({
  title,
  message,
  buttonText,
  resultsText,
  error,
  isValidating,
  validationFunction,
  disableButton = false,
}) => {
  return (
    <div className="container" style={{ border: 0 }}>
      <Stack hasGutter>
        <StackItem>
          {error === true && <ExclamationCircleIcon size="xl" color="red" />}
          {error === false && <CheckCircleIcon size="xl" color="green" />}
          <Title headingLevel="h1">{title}</Title>
        </StackItem>
        <StackItem>
          <Title headingLevel="h2">{message}</Title>
        </StackItem>
        <StackItem>
          <Title headingLevel="h3" style={{ color: error ? "red" : "inherit" }}>
            {resultsText}
          </Title>
        </StackItem>
        <StackItem>
          <Button
            isLoading={isValidating}
            onClick={validationFunction}
            isDisabled={disableButton}
          >
            {buttonText}
          </Button>
        </StackItem>
      </Stack>
    </div>
  );
};
