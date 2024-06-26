import React, { FC } from "react";
import { InstructionProps, Step, StepImage } from "@wizardComponents";
import * as Images from "@app/images/pingone";

export const Step1: FC = () => {
  const instructions: InstructionProps[] = [
    {
      text: 'In your PingOne Admin dashboard, select "Connections" from the sidebar menu, and then select "Applications" from the next list. On this page, select the "+" button next to the “Applications” header.',
      component: <StepImage src={Images.PINGONE_SAML_1} alt="Step 1.1" />,
    },
    {
      text: 'In the pane that opens, enter an “Application Name” and “Description”. Select “SAML Application” and then click “Configure”.',
      component: <StepImage src={Images.PINGONE_SAML_2} alt="Step 1.2" />,
    },
  ];

  return (
    <Step
      title="Step 1: Add a SAML Application"
      instructionList={instructions}
    />
  );
};
