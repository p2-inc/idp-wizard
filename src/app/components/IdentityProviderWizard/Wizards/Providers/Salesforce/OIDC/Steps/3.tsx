import React from "react";
import SalesforceCommonStep3Image from "@app/images/salesforce/COMMON/salesforce-3.png";
import SalesforceCommonStep4Image from "@app/images/salesforce/COMMON/salesforce-4.png";
import SalesforceCommonStep5Image from "@app/images/salesforce/COMMON/salesforce-5.png";
import { InstructionProps, Step, StepImage } from "@wizardComponents";

export function SalesforceStepThree() {
  const instructions: InstructionProps[] = [
    {
      text: (
        <div>
          On the next page, click the <b>Manage</b> button to view your app's OIDC configuration.
        </div>
      ),
      component: <StepImage src={SalesforceCommonStep3Image} alt="Step 3.1" />,
    },
    {
      text: (
        <div>
          Under the <b>Profiles</b> section, click <b>Manage Profiles</b> to assign the connected app to the appropriate profiles.
        </div>
      ),
      component: <StepImage src={SalesforceCommonStep4Image} alt={`Step 3.1`} />,
    },
    {
      text: (
        <div>
          Select the desired profiles then click <b>Save</b> at the bottom of the page.
        </div>
      ),
      component: <StepImage src={SalesforceCommonStep5Image} alt={`Step 3.2`} />,
    }
  ];

  return (
    <Step
      title={`Step 3: Assign Profiles`}
      instructionList={instructions}
    />
  );
}
