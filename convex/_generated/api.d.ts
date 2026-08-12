/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _utils_clerkUserManagement from "../_utils/clerkUserManagement.js";
import type * as _utils_documentSecurity from "../_utils/documentSecurity.js";
import type * as _utils_env from "../_utils/env.js";
import type * as _utils_invitationBypass from "../_utils/invitationBypass.js";
import type * as _utils_notifications from "../_utils/notifications.js";
import type * as _utils_resend from "../_utils/resend.js";
import type * as _utils_stripe from "../_utils/stripe.js";
import type * as _utils_twilio from "../_utils/twilio.js";
import type * as adpOutbound from "../adpOutbound.js";
import type * as adpSync from "../adpSync.js";
import type * as agencyConfig from "../agencyConfig.js";
import type * as audit from "../audit.js";
import type * as auditReadiness from "../auditReadiness.js";
import type * as authHelpers from "../authHelpers.js";
import type * as backgroundChecks from "../backgroundChecks.js";
import type * as billing from "../billing.js";
import type * as billingHelpers from "../billingHelpers.js";
import type * as candidates from "../candidates.js";
import type * as clients from "../clients.js";
import type * as compliance from "../compliance.js";
import type * as crons from "../crons.js";
import type * as disableUserMfa from "../disableUserMfa.js";
import type * as documentArchive from "../documentArchive.js";
import type * as drafts from "../drafts.js";
import type * as embedding from "../embedding.js";
import type * as employeeProfiles from "../employeeProfiles.js";
import type * as escalations from "../escalations.js";
import type * as files from "../files.js";
import type * as forms from "../forms.js";
import type * as hrCases from "../hrCases.js";
import type * as http from "../http.js";
import type * as integrations_adp_adpClient from "../integrations/adp/adpClient.js";
import type * as integrations_adp_adpPort from "../integrations/adp/adpPort.js";
import type * as integrations_adp_config from "../integrations/adp/config.js";
import type * as integrations_adp_errors from "../integrations/adp/errors.js";
import type * as integrations_adp_mockAdp from "../integrations/adp/mockAdp.js";
import type * as invitations from "../invitations.js";
import type * as locationValidation from "../locationValidation.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as platform from "../platform.js";
import type * as platformBilling from "../platformBilling.js";
import type * as platformStripe from "../platformStripe.js";
import type * as platformTrainingCompletions from "../platformTrainingCompletions.js";
import type * as reporting from "../reporting.js";
import type * as reviews from "../reviews.js";
import type * as scheduling from "../scheduling.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seedPhase3Data from "../seedPhase3Data.js";
import type * as seedPlatformAdmin from "../seedPlatformAdmin.js";
import type * as shiftLifecycle from "../shiftLifecycle.js";
import type * as shiftQueries from "../shiftQueries.js";
import type * as shiftValidation from "../shiftValidation.js";
import type * as shifts from "../shifts.js";
import type * as tenantSettings from "../tenantSettings.js";
import type * as tenants from "../tenants.js";
import type * as timePunches from "../timePunches.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_utils/clerkUserManagement": typeof _utils_clerkUserManagement;
  "_utils/documentSecurity": typeof _utils_documentSecurity;
  "_utils/env": typeof _utils_env;
  "_utils/invitationBypass": typeof _utils_invitationBypass;
  "_utils/notifications": typeof _utils_notifications;
  "_utils/resend": typeof _utils_resend;
  "_utils/stripe": typeof _utils_stripe;
  "_utils/twilio": typeof _utils_twilio;
  adpOutbound: typeof adpOutbound;
  adpSync: typeof adpSync;
  agencyConfig: typeof agencyConfig;
  audit: typeof audit;
  auditReadiness: typeof auditReadiness;
  authHelpers: typeof authHelpers;
  backgroundChecks: typeof backgroundChecks;
  billing: typeof billing;
  billingHelpers: typeof billingHelpers;
  candidates: typeof candidates;
  clients: typeof clients;
  compliance: typeof compliance;
  crons: typeof crons;
  disableUserMfa: typeof disableUserMfa;
  documentArchive: typeof documentArchive;
  drafts: typeof drafts;
  embedding: typeof embedding;
  employeeProfiles: typeof employeeProfiles;
  escalations: typeof escalations;
  files: typeof files;
  forms: typeof forms;
  hrCases: typeof hrCases;
  http: typeof http;
  "integrations/adp/adpClient": typeof integrations_adp_adpClient;
  "integrations/adp/adpPort": typeof integrations_adp_adpPort;
  "integrations/adp/config": typeof integrations_adp_config;
  "integrations/adp/errors": typeof integrations_adp_errors;
  "integrations/adp/mockAdp": typeof integrations_adp_mockAdp;
  invitations: typeof invitations;
  locationValidation: typeof locationValidation;
  members: typeof members;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  platform: typeof platform;
  platformBilling: typeof platformBilling;
  platformStripe: typeof platformStripe;
  platformTrainingCompletions: typeof platformTrainingCompletions;
  reporting: typeof reporting;
  reviews: typeof reviews;
  scheduling: typeof scheduling;
  search: typeof search;
  seed: typeof seed;
  seedPhase3Data: typeof seedPhase3Data;
  seedPlatformAdmin: typeof seedPlatformAdmin;
  shiftLifecycle: typeof shiftLifecycle;
  shiftQueries: typeof shiftQueries;
  shiftValidation: typeof shiftValidation;
  shifts: typeof shifts;
  tenantSettings: typeof tenantSettings;
  tenants: typeof tenants;
  timePunches: typeof timePunches;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
