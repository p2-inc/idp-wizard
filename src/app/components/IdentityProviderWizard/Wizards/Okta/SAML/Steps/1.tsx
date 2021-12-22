import React, { FC } from "react";
import { InstructionProps, Step, StepImage } from "@wizardComponents";
import * as Images from "@app/images/okta/saml";

export const Step1: FC = () => {
  const instructions: InstructionProps[] = [
    {
      text: 'In your Okta Administration dashboard, select "Applications" from the menu. On this page, select the "Create App Integration" button.',
      component: <StepImage src={Images.OktaSaml1} alt="Step 1.1" />,
    },
    {
      text: 'Select "SAML 2.0" for the "Sign-in method" and click "Next"',
      component: <StepImage src={Images.OktaSaml2} alt="Step 1.2" />,
    },
    {
      text: 'Enter an "App name" and click "Next".',
      component: <StepImage src={Images.OktaSaml3} alt="Step 1.3" />,
    },
  ];

  return (
    <Step
      title="Step 1: Create Enterprise Application"
      instructionList={instructions}
    />
  );
};
