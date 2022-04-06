import {
  createApi,
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import keycloak from "../../../keycloak";

export interface FeatureFlagsState {
  groupMapping: boolean;
  apiMode: "cloud" | "onprem" | "";
  enableLdap: boolean;
  enableDashboard: boolean;
}

type FlagsResponse = FeatureFlagsState;

enum Flags {
  GroupMapping = "groupMapping",
  ApiMode = "apiMode",
  EnableLdap = "enableLdap",
  EnableDashboard = "enableDashboard",
}

const initialState: FeatureFlagsState = {
  groupMapping: false,
  apiMode: "",
  enableLdap: false,
  enableDashboard: false,
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "https://app.phasetwo.io",
});

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
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

export const featureFlagApi = createApi({
  reducerPath: "featureFlagsApi",
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    getFeatureFlags: builder.query<FlagsResponse, void>({
      query: () => `config.json`,
    }),
  }),
});

export const { useGetFeatureFlagsQuery } = featureFlagApi;
