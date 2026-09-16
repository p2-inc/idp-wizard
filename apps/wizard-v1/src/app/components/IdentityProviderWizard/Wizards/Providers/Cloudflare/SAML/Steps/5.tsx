import React from "react";
import * as Images from "@app/images/cloudflare/saml";
import { InstructionProps, Step, StepImage } from "@wizardComponents";
import { useHostname } from "@app/hooks/useHostname";

export function CloudflareStepFive() {
  const hostname = useHostname();
  const instructionList: InstructionProps[] = [
    {
      text: (
        <div>
          Add a policy to your app. If you do not have one created yet, then you
          must do so from the in Access Control {">"} Policies or click "+
          Create New Policy".
        </div>
      ),
      component: <StepImage src={Images.CloudflareSaml6} alt="Step 5.1" />,
    },
    {
      text: (
        <div>
          Set a name for the access policy, then add any groups or rules
          defining who can access the application.
        </div>
      ),
      component: <StepImage src={Images.CloudflareSaml7} alt="Step 5.2" />,
    },
    {
      text: (
        <div>
          Assign the policy to the application by selecting it from the dropdown
          menu, then click <b>Confirm</b>.
        </div>
      ),
      component: <StepImage src={Images.CloudflareSaml8} alt="Step 5.3" />,
    },
  ];

  return (
    <Step
      title="Step 5: Assign Access Policy"
      instructionList={instructionList}
    />
  );
}
