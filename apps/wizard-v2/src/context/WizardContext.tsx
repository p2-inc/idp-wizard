import { createContext, useContext } from "react";
import type { OrgsClient, AdminClient } from "@/api/clients";

/** Resolved API endpoint URLs, scoped to the current org/realm. */
export interface WizardEndpoints {
  /** POST — validates metadata URL/file/manual config, returns IDP config object */
  importConfig: string;
  /** POST — creates the identity provider */
  createIdp: string;
  /** POST — adds attribute mappers to an existing IDP */
  addMappers: (alias: string) => string;
}

/** Read-only derived values the wizard templates can reference as {{api.*}} */
export interface WizardApi {
  entityId: string;
  ssoUrl: (alias: string) => string;
  samlMetadata: string;
  adminLinkSaml: (alias: string) => string;
  adminLinkOidc: (alias: string) => string;
  endpoints: WizardEndpoints;
}

export interface WizardContextValue {
  /** Keycloak org ID — present when launched from an organization, null for realm-wide */
  orgId: string | null;
  /** Determines which set of API endpoints to use */
  apiMode: "cloud" | "onprem";
  realm: string;
  serverUrl: string;
  api: WizardApi;
  /** Typed client for Phase Two Orgs API (cloud / org-scoped mode) */
  orgsClient: OrgsClient;
  /** Typed client for Keycloak Admin API (onprem / realm-wide mode) */
  adminClient: AdminClient;
  /** The active client for the current apiMode */
  activeClient: OrgsClient | AdminClient;
  /** Mutable wizard step state and dispatcher — set by the wizard runner */
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Wizard state + reducer
// ---------------------------------------------------------------------------

export interface WizardState {
  [key: string]: unknown;
  alias: string;
  currentStep: number;
  stepIdReached: number;
  /** Raw IDP config returned from the import-config endpoint */
  metadata: Record<string, unknown> | null;
  metadataValidated: boolean;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  result: string | null;
  idpTestLink: string | null;
}

export type WizardAction =
  | { type: "ADVANCE_STEP"; toStep: number }
  | { type: "SET_METADATA"; metadata: Record<string, unknown> }
  | { type: "METADATA_VALIDATED" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; result: string; idpTestLink?: string }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "CLEAR_ERROR" };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "ADVANCE_STEP":
      return {
        ...state,
        currentStep: action.toStep,
        stepIdReached: Math.max(state.stepIdReached, action.toStep),
      };
    case "SET_METADATA":
      return { ...state, metadata: action.metadata };
    case "METADATA_VALIDATED":
      return { ...state, metadataValidated: true };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        submitted: true,
        result: action.result,
        idpTestLink: action.idpTestLink ?? null,
      };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.error };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

export function makeInitialWizardState(alias: string): WizardState {
  return {
    alias,
    currentStep: 1,
    stepIdReached: 1,
    metadata: null,
    metadataValidated: false,
    submitting: false,
    submitted: false,
    error: null,
    result: null,
    idpTestLink: null,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizardContext(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizardContext must be used within a WizardContext.Provider");
  return ctx;
}
