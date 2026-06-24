/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adpSync from "../adpSync.js";
import type * as audit from "../audit.js";
import type * as authHelpers from "../authHelpers.js";
import type * as billing from "../billing.js";
import type * as billingHelpers from "../billingHelpers.js";
import type * as clients from "../clients.js";
import type * as embedding from "../embedding.js";
import type * as files from "../files.js";
import type * as invitations from "../invitations.js";
import type * as locationValidation from "../locationValidation.js";
import type * as members from "../members.js";
import type * as platform from "../platform.js";
import type * as reviews from "../reviews.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as shiftLifecycle from "../shiftLifecycle.js";
import type * as shiftQueries from "../shiftQueries.js";
import type * as shiftValidation from "../shiftValidation.js";
import type * as shifts from "../shifts.js";
import type * as tenantSettings from "../tenantSettings.js";
import type * as tenants from "../tenants.js";
import type * as timePunches from "../timePunches.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adpSync: typeof adpSync;
  audit: typeof audit;
  authHelpers: typeof authHelpers;
  billing: typeof billing;
  billingHelpers: typeof billingHelpers;
  clients: typeof clients;
  embedding: typeof embedding;
  files: typeof files;
  invitations: typeof invitations;
  locationValidation: typeof locationValidation;
  members: typeof members;
  platform: typeof platform;
  reviews: typeof reviews;
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
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
