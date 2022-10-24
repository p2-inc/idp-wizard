import { Axios } from "./axios";
import { useGetFeatureFlagsQuery } from "@app/services";
import IdentityProviderRepresentation from "@keycloak/keycloak-admin-client/lib/defs/identityProviderRepresentation";

const usernameAttributeName = "username";
const emailAttributeName = "email";
const firstNameAttributeName = "firstName";
const lastNameAttributeName = "lastName";
const idpUsernameAttributeName = "idpUsername";

type CreateIdpProps = {
  createIdPUrl: string;
  payload: IdentityProviderRepresentation;
};
  
export const CreateIdp = async ({
  createIdPUrl,
  payload,
}: CreateIdpProps) => {
  const { data: featureFlags } = useGetFeatureFlagsQuery();
  payload.trustEmail = featureFlags?.trustEmail;
  return Axios.post(createIdPUrl, payload);
};

type AttributesConfig = {
  attributeName: string;
  userAttribute: string;
  friendlyName: string;
};
  
type AttributesProps = {
  alias: string;
  attributes: AttributesConfig[];
  createIdPUrl: string;
};
  
type MapperConfig = {
  attributeName: string;
  friendlyName: string;
};

type MapperProps = {
  createIdPUrl: string;
  alias: string;
  usernameAttribute: MapperConfig;
  emailAttribute: MapperConfig;
  firstNameAttribute: MapperConfig;
  lastNameAttribute: MapperConfig;
  attributes?: AttributesConfig[];
};

export const SamlAttributeMapper = async ({
  createIdPUrl,
  alias,
  usernameAttribute,
  emailAttribute,
  firstNameAttribute,
  lastNameAttribute,
  attributes = [],
}: MapperProps) => {
  const { data: featureFlags } = useGetFeatureFlagsQuery();
  if (featureFlags?.emailAsUsername) {
    // create a new attribute mapper with the idpUsername from the usernameAttribute
    attributes.push({
      attributeName: usernameAttribute.attributeName,
      friendlyName: usernameAttribute.friendlyName,
      userAttribute: idpUsernameAttributeName,
    });
    // update the usernameAttribute with the emailAttribute attributeName and friendlyName
    usernameAttribute.attributeName = emailAttribute.attributeName;
    usernameAttribute.friendlyName = emailAttribute.friendlyName;
  }
  attributes.push({
    attributeName: usernameAttribute.attributeName,
    friendlyName: usernameAttribute.friendlyName,
    userAttribute: usernameAttributeName,
  });
  attributes.push({
    attributeName: emailAttribute.attributeName,
    friendlyName: emailAttribute.friendlyName,
    userAttribute: emailAttributeName,
  });
  attributes.push({
    attributeName: firstNameAttribute.attributeName,
    friendlyName: firstNameAttribute.friendlyName,
    userAttribute: firstNameAttributeName,
  });
  attributes.push({
    attributeName: lastNameAttribute.attributeName,
    friendlyName: lastNameAttribute.friendlyName,
    userAttribute: lastNameAttributeName,
  });

  return SamlUserAttributeMapper({
    alias,
    attributes,
    createIdPUrl,
  });
};

export const SamlUserAttributeMapper = async ({
  alias,
  attributes,
  createIdPUrl,
}: AttributesProps) => {
  const mapAttribute = async ({
    attributeName,
    friendlyName,
    userAttribute,
  }: AttributesConfig) => {
    let endpoint = `${createIdPUrl}/${alias}/mappers`;
    /*
      ? `${createIdpUrl}/${alias}/mappers`
      : `${serverUrl}/${realm}/identity-provider/instances/${alias}/mappers`;
    */
    return await Axios.post(endpoint, {
      identityProviderAlias: alias,
      config: {
        syncMode: "INHERIT",
        attributes: "[]",
        "attribute.name": attributeName,
        "attribute.friendly.name": friendlyName,
        "user.attribute": userAttribute,
      },
      name: userAttribute,
      identityProviderMapper: "saml-user-attribute-idp-mapper",
    });
  };

  return Promise.all(attributes.map((atr) => mapAttribute(atr)));
};
