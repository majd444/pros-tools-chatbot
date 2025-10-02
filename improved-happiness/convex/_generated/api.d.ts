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
import type * as agents from "../agents.js";
import type * as chat from "../chat.js";
import type * as chatWidget from "../chatWidget.js";
import type * as discord from "../discord.js";
import type * as fineTuning from "../fineTuning.js";
import type * as http from "../http.js";
import type * as metaConfigs from "../metaConfigs.js";
import type * as railway from "../railway.js";
import type * as sessions from "../sessions.js";
import type * as telegramConfigs from "../telegramConfigs.js";
import type * as test from "../test.js";
import type * as testQueries from "../testQueries.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  chat: typeof chat;
  chatWidget: typeof chatWidget;
  discord: typeof discord;
  fineTuning: typeof fineTuning;
  http: typeof http;
  metaConfigs: typeof metaConfigs;
  railway: typeof railway;
  sessions: typeof sessions;
  telegramConfigs: typeof telegramConfigs;
  test: typeof test;
  testQueries: typeof testQueries;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
