import React, { FC, useState } from "react";
import * as Images from "@app/images/msft_entra_id/saml";
import { InstructionProps, Step, StepImage } from "@wizardComponents";
import { ClipboardCopyComponent } from "@wizardComponents";

interface Props {
  acsUrl: string;
  entityId: string;
}

export const EntraIdStepTwo: FC<Props> = ({ acsUrl, entityId }) => {
  const instructionList: InstructionProps[] = [
    {
      text: "Click the Edit icon in the top right of the first step.",
      component: <StepImage src={Images.AzureSaml5} alt="Step 2.1" />,
    },
    {
      text: 'Click the "Add identifier" and "Add reply URL" links to open the fields for editing.',
      component: <StepImage src={Images.AzureSaml5a} alt="Step 2.1.a" />,
    },
    {
      component: (
        <ClipboardCopyComponent
          label="Copy this identifier"
          initialValue={entityId}
        />
      ),
    },
    {
      component: (
        <ClipboardCopyComponent
          label="Copy this Reply URL"
          initialValue={acsUrl}
        />
      ),
    },
    {
      text: "Submit the identifier and the Reply URL in the Basic SAML Configuration. Click the 'Save' button when you have pasted both values.",
      component: <StepImage src={Images.AzureSaml6} alt="Step 2.2" />,
    },
  ];

  return (
    <Step
      title="Step 2: Basic SAML Configuration"
      instructionList={instructionList}
    />
  );
};
