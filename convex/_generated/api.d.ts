/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adpOutbound from "../adpOutbound.js";
import type * as adpSync from "../adpSync.js";
import type * as audit from "../audit.js";
import type * as authHelpers from "../authHelpers.js";
import type * as billing from "../billing.js";
import type * as billingHelpers from "../billingHelpers.js";
import type * as candidates from "../candidates.js";
import type * as clients from "../clients.js";
import type * as embedding from "../embedding.js";
import type * as employeeProfiles from "../employeeProfiles.js";
import type * as files from "../files.js";
import type * as integrations_adp_adpClient from "../integrations/adp/adpClient.js";
import type * as integrations_adp_adpPort from "../integrations/adp/adpPort.js";
import type * as integrations_adp_config from "../integrations/adp/config.js";
import type * as integrations_adp_errors from "../integrations/adp/errors.js";
import type * as integrations_adp_mockAdp from "../integrations/adp/mockAdp.js";
import type * as invitations from "../invitations.js";
import type * as locationValidation from "../locationValidation.js";
import type * as members from "../members.js";
import type * as platform from "../platform.js";
import type * as platformTrainingCompletions from "../platformTrainingCompletions.js";
import type * as reviews from "../reviews.js";
import type * as scheduling from "../scheduling.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
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
  adpOutbound: typeof adpOutbound;
  adpSync: typeof adpSync;
  audit: typeof audit;
  authHelpers: typeof authHelpers;
  billing: typeof billing;
  billingHelpers: typeof billingHelpers;
  candidates: typeof candidates;
  clients: typeof clients;
  embedding: typeof embedding;
  employeeProfiles: typeof employeeProfiles;
  files: typeof files;
  "integrations/adp/adpClient": typeof integrations_adp_adpClient;
  "integrations/adp/adpPort": typeof integrations_adp_adpPort;
  "integrations/adp/config": typeof integrations_adp_config;
  "integrations/adp/errors": typeof integrations_adp_errors;
  "integrations/adp/mockAdp": typeof integrations_adp_mockAdp;
  invitations: typeof invitations;
  locationValidation: typeof locationValidation;
  members: typeof members;
  platform: typeof platform;
  platformTrainingCompletions: typeof platformTrainingCompletions;
  reviews: typeof reviews;
  scheduling: typeof scheduling;
  search: typeof search;
  seed: typeof seed;
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
