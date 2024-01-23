import {
  createApi,
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import keycloak from "../../../keycloak";
import keycloakJson from "../../../keycloak.json";

export interface FeatureFlagsState {
  usernameMapperImport: boolean;
  enableGroupMapping: boolean;
  apiMode: "cloud" | "onprem" | "";
  enableLdap: boolean;
  enableDashboard: boolean;
  emailAsUsername: boolean;
  trustEmail: boolean;
  displayName: string;
  domain: string;
  logoUrl: string;
  name: string;
}

type FlagsResponse = FeatureFlagsState;

enum Flags {
  UsernameMapperImport = "usernameMapperImport",
  EnableGroupMapping = "enableGroupMapping",
  ApiMode = "apiMode",
  EnableLdap = "enableLdap",
  EnableDashboard = "enableDashboard",
  EmailAsUsername = "emailAsUsername",
  TrustEmail = "trustEmail",
}

const initialState: FeatureFlagsState = {
  usernameMapperImport: true,
  enableGroupMapping: false,
  apiMode: "",
  enableLdap: false,
  enableDashboard: false,
  emailAsUsername: false,
  trustEmail: false,
  displayName: "Identity Provider",
  domain: "",
  logoUrl: null,
  name: null,
};

const baseUrl = () => {
  // console.log("[keycloak.authServerUrl]", keycloak.authServerUrl);
  if (keycloak.authServerUrl) {
    const u = new URL(keycloak.authServerUrl);
    return u.origin;
  } else {
    console.log("authServerUrl not set");
    return `${window.location.protocol}//${window.location.host}`;
  }
};

// const API_HOST = ENV.API_HOST || keycloak.authHost;

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: baseUrl(),
  });

  // TODO: @xgp is this the correct realm to leverage? or should it be pathRealm?
  const pathRealm = keycloak.realm;
  // const pathRealm = window.location.pathname.split("/")[4];

  // gracefully handle scenarios where data to generate the URL is missing
  if (!pathRealm) {
    return {
      error: {
        status: 400,
        statusText: "Bad Request",
        data: "No realm available.",
      },
    };
  }

  const urlEnd = typeof args === "string" ? args : args.url;
  // construct a dynamically generated portion of the url
  const adjustedUrl = `auth/realms/${pathRealm}/wizard/${urlEnd}`;
  const adjustedArgs =
    typeof args === "string" ? adjustedUrl : { ...args, url: adjustedUrl };

  return rawBaseQuery(adjustedArgs, api, extraOptions);
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    getFeatureFlags: builder.query<FlagsResponse, void>({
      query: () => `config.json`,
    }),
  }),
});

export const { useGetFeatureFlagsQuery } = apiSlice;
