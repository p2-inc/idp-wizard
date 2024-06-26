import React, { FC } from "react";
import {
  InstructionProps,
  Step,
  StepImage,
  DoubleItemClipboardCopy,
} from "@wizardComponents";
import * as Images from "@app/images/aws";

export const Step4: FC = () => {
  const instructions: InstructionProps[] = [
    {
      text: 'Navigate to the attribute mapping section by opening the "Actions" dropdown in the "Details section. Select "Edit attribute mappings".',
      component: <StepImage src={Images.AWS_SSO_SAML_5_A} alt="Step 4.1.a" />,
    },
    {
      component: (
        <div>
          In the "Attribute mappings" section, provide the following attribute
          mappings and select "Save". Note you may need to click "+ Add new 
          attribute mapping" to configure each of the mappings. Format should be
          set to "unspecified" for each of the mappings. When you are finished, 
          click "Save changes" before proceeding.
        </div>
      ),
    },
    {
      component: (
        <div>
          <DoubleItemClipboardCopy
            leftValue="Subject"
            rightValue="${user:subject}"
          />
          <DoubleItemClipboardCopy
            leftValue="firstName"
            rightValue="${user:givenName}"
          />
          <DoubleItemClipboardCopy
            leftValue="lastName"
            rightValue="${user:familyName}"
          />
          <DoubleItemClipboardCopy
            leftValue="email"
            rightValue="${user:email}"
          />
        </div>
      ),
    },
    {
      component: <StepImage src={Images.AWS_SSO_SAML_5} alt="Step 4.1" />,
    },
  ];

  return (
    <Step
      title="Step 4: Configure Attribute Mapping"
      instructionList={instructions}
    />
  );
};
