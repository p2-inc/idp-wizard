import React, { FC, useEffect, useState } from "react";
import { useParams } from "react-router";
import { AzureWizard } from "./AzureWizard/AzureWizard";
import { Auth0Wizard } from "./Auth0Wizard/Auth0Wizard";
import { OktaWizard } from "./OktaWizard/OktaWizard";

const Provider = () => {
  const { provider } = useParams();

  switch (provider) {
    case "okta":
      return <OktaWizard />;
    case "azure":
      return <AzureWizard />;
    case "auth0":
      return <Auth0Wizard />;

    default:
      return <div>No provider found</div>;
  }
};

export default Provider;
