import {
  Alert,
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";
import React, { useState, FC } from "react";
import Auth0Step3Image from "@app/images/auth0/auth0-3.png";
import { InstructionProps, Step, StepImage } from "@wizardComponents";
import { useSessionStorage } from "react-use";
import { auth0StepTwoValidation } from "@app/services/Auth0Validation";

interface Props {
  onChange: (value: boolean) => void;
}

export const Auth0StepTwo: FC<Props> = (props) => {
  const [alertText, setAlertText] = useState("");
  const [alertVariant, setAlertVariant] = useState("default");
  const [isValidating, setIsValidating] = useState(false);
  const [domain, setDomain] = useSessionStorage("auth0_domain", "");
  const [clientId, setClientID] = useSessionStorage("auth0_clientID", "");
  const [clientSecret, setClientSecret] = useSessionStorage("auth0_clientSecret", "");
  
  const handleDomainChange = (value: string) => {
    setDomain(value);
    //Store the data to session storage
  };
   const handleClientIDValueChange = (value: string) => {
    setClientID(value);
    //Store the data to session storage
  }; 
  const handleClientSecretValueChange = (value: string) => {
    setClientSecret(value);
    //Store the data to session storage
  };

  

  const validateStep = async () => {
    setIsValidating(true);
    //console.log("testing auth0 validation")
    await auth0StepTwoValidation(domain, false)
      .then((res) => {
        setAlertText(res.message);
        setAlertVariant(res.status);
        props.onChange(true);
      })
      .catch(() => {
        setAlertVariant("error");
        setAlertText("Error, could not create IdP in Keycloak");
      });
    setIsValidating(false);
  };


  const instructions: InstructionProps[] = [
    {      
      component: <StepImage src={Auth0Step3Image} alt="Step 2.1" />,
    },
    {
      component: (
        <Card className="card-shadow">
          <CardBody>
            {alertText && (
              <Alert
                variant={alertVariant == "error" ? "danger" : "success"}
                isInline
                title={alertText}
              />
            )}

            <Form>
              <FormGroup
                label="Domain"
                isRequired
                fieldId="domain"
                className="form-label"
              >
                <TextInput
                  isRequired
                  type="text"
                  id="domain-text"
                  name="Domain"
                  aria-describedby="Domain"
                  value = {domain}
                  onChange={handleDomainChange}
                />
              </FormGroup>
              <FormGroup
                label="Client ID"
                isRequired
                fieldId="client-id"
                className="form-label"
              >
                <TextInput
                  isRequired
                  type="text"
                  id="client-id-text"
                  name="Client ID"
                  aria-describedby="Client ID"
                  value={clientId}
                  onChange={handleClientIDValueChange}
                />
              </FormGroup>
              <FormGroup
                label="Client Secret"
                isRequired
                fieldId="client-secret"
                className="form-label"
              >
                <TextInput
                  isRequired
                  type="text"
                  id="client-secret-text"
                  name="Client Secret"
                  aria-describedby="Client Secret"
                  value={clientSecret}
                  onChange={handleClientSecretValueChange}
                />
              </FormGroup>
              <Button
                style={{ textAlign: "center" }}
                isLoading={isValidating}
                onClick={validateStep}
              >
                Validate Auth0 App Basic Settings
              </Button>
            </Form>
          </CardBody>
        </Card>
      ),
    },
  ];

  return (    
    <Step
      title="Step 2: Provide Domain And Credentials"
      instructionList={instructions}
    />
  );
}
