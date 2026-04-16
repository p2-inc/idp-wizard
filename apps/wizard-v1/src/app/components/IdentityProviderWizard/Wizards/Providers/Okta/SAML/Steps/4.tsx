import React, { FC } from "react";
import {
  DoubleItemClipboardCopy,
  InstructionProps,
  Step,
  StepImage,
} from "@wizardComponents";
import * as Images from "@app/images/okta/saml";

export const Step4: FC = () => {
  const instructions: InstructionProps[] = [
    {
      component: (
        <div>
          Once on the application page, select the "Sign On" tab, in the
          "Attribute statements" section, expand the "Show legacy configuration"
          and provide the following attribute mappings and select "Save". Note
          you may need to click "Add Another" to configure each of the mappings.
        </div>
      ),
    },
    {
      component: (
        <div>
          Note that if "user.login" is not present in your Okta account, try
          "user.id" or do not add this mapping.
        </div>
      ),
    },
    {
      component: (
        <>
          <DoubleItemClipboardCopy leftValue="email" rightValue="user.email" />
          <DoubleItemClipboardCopy
            leftValue="firstName"
            rightValue="user.firstName"
          />
          <DoubleItemClipboardCopy
            leftValue="lastName"
            rightValue="user.lastName"
          />
          <DoubleItemClipboardCopy leftValue="id" rightValue="user.login" />
          <div>
            Note that if "user.login" is not present in your Okta account, try
            "user.id" or do not add this mapping.
          </div>
        </>
      ),
    },
    {
      component: <StepImage src={Images.OktaSaml5} alt="Step 3.2" />,
    },
  ];

  return (
    <Step
      title="Step 4: Configure Attribute Mapping"
      instructionList={instructions}
    />
  );
};
