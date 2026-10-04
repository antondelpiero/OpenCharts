/**
 * Demo API facade.
 *
 * OpenCharts runs without a backend: all real data the terminal needs is served
 * by the in-browser demo layer (services/demo). `api` is the demo implementation
 * wrapped in a Proxy whose fallback returns a benign async no-op for any method
 * not implemented in demo mode — so leftover calls from non-terminal code resolve
 * harmlessly instead of throwing network errors.
 */
import { demoApi } from "./demo/api.ts";

export const API_BASE = "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// react-query rejects `undefined` query results, so resolve to null instead.
const benign = () => Promise.resolve(null);

/**
 * The demo implementations ignore the caller's arguments — there is one demo
 * account, so `getAccount(id)` and `getAccount()` return the same thing — and
 * are written parameterless. Callers still pass the real API's arguments, so
 * widen each method's parameter list while preserving its return type. The
 * previous `Record<string, (...args: never[]) => Promise<unknown>>` intersection
 * applied to *every* key, erasing the demo methods' own return types along with
 * their parameters.
 */
type DemoApiCallable<T> = {
  [K in keyof T]: T[K] extends (...args: infer P) => infer R
    ? P extends readonly []
      ? (...args: unknown[]) => R
      : T[K]
    : T[K];
};

/**
 * Endpoints that existed on the hosted prop-firm API but have no demo
 * implementation — leaderboards, competitions, support tickets, payouts, push
 * notifications, bot integrations and similar. The Proxy below resolves each of
 * them to `benign`, so the calls are harmless no-ops that return `null`.
 *
 * They are listed explicitly rather than covered by a string index signature:
 * under `noUncheckedIndexedAccess` an index signature types every lookup as
 * `possibly undefined`, which makes the call sites unusable. Naming them also
 * keeps this list as the running inventory of non-terminal code still to be
 * removed — delete an entry here once its caller is gone.
 */
type LegacyEndpoint = (...args: unknown[]) => Promise<null>;

type LegacyApi = {
  changePassword: LegacyEndpoint;
  clearAiTraderHistory: LegacyEndpoint;
  closeTicket: LegacyEndpoint;
  connectBot: LegacyEndpoint;
  createAiTraderPlan: LegacyEndpoint;
  createBotIntegration: LegacyEndpoint;
  createScalingPlan: LegacyEndpoint;
  createTicket: LegacyEndpoint;
  deleteBotIntegration: LegacyEndpoint;
  disconnectBot: LegacyEndpoint;
  enrollInCompetition: LegacyEndpoint;
  enrollScaling: LegacyEndpoint;
  executeAiTraderPlan: LegacyEndpoint;
  getActiveCompetitions: LegacyEndpoint;
  getAiTraderHistory: LegacyEndpoint;
  getAllPayouts: LegacyEndpoint;
  getAnalyticsAggregate: LegacyEndpoint;
  getAnalyticsSnapshots: LegacyEndpoint;
  getBotActivityLogs: LegacyEndpoint;
  getBotIntegrations: LegacyEndpoint;
  getBotStatus: LegacyEndpoint;
  getCompetitionRankings: LegacyEndpoint;
  getDailyPnl: LegacyEndpoint;
  getFirmLeaderboard: LegacyEndpoint;
  getLeaderboard: LegacyEndpoint;
  getLeaderboardPrizes: LegacyEndpoint;
  getLeaderboardStats: LegacyEndpoint;
  getMergeRequests: LegacyEndpoint;
  getMyAwards: LegacyEndpoint;
  getMyCertificates: LegacyEndpoint;
  getMyCompetitionEntries: LegacyEndpoint;
  getMyFirm: LegacyEndpoint;
  getMyLeaderboardRank: LegacyEndpoint;
  getMyProfitSplit: LegacyEndpoint;
  getMyTickets: LegacyEndpoint;
  getPatterns: LegacyEndpoint;
  getPreferences: LegacyEndpoint;
  getProfitSplitConfig: LegacyEndpoint;
  getPublicProfile: LegacyEndpoint;
  getPublicProfiles: LegacyEndpoint;
  getPushSubscriptions: LegacyEndpoint;
  getScalingPlans: LegacyEndpoint;
  getScalingProgress: LegacyEndpoint;
  getTicket: LegacyEndpoint;
  getVapidPublicKey: LegacyEndpoint;
  markAllAnnouncementsRead: LegacyEndpoint;
  markAnnouncementRead: LegacyEndpoint;
  processMergeRequest: LegacyEndpoint;
  replyToTicket: LegacyEndpoint;
  requestAccountMerge: LegacyEndpoint;
  sendTestNotification: LegacyEndpoint;
  subscribePush: LegacyEndpoint;
  testBotIntegration: LegacyEndpoint;
  unsubscribePush: LegacyEndpoint;
  updateBotIntegration: LegacyEndpoint;
  updateProfile: LegacyEndpoint;
  updateProfitSplitConfig: LegacyEndpoint;
  validateCoupon: LegacyEndpoint;
};

export const api = new Proxy(demoApi as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    return benign;
  },
}) as DemoApiCallable<typeof demoApi> & LegacyApi;
