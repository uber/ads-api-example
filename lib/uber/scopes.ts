/**
 * OAuth scopes requested at login.
 *
 * Mostly from the spec's `components.securitySchemes.auth`, with one addition:
 * the spec declares `ads.reporting` for `POST /reporting/sync`, but the live
 * API rejects it with "requires at least one of the following scopes:
 * ads.sync.reporting". The async job endpoints do use `ads.reporting`, so both
 * are needed to cover all three reporting calls.
 *
 * @see openapi/uber-ads.json -> components.securitySchemes.auth
 */
export const UBER_ADS_SCOPES = [
  'ads.ad-accounts.read',
  'ads.campaigns.read',
  'ads.campaigns.write',
  'ads.products.read',
  'ads.reporting',
  'ads.sync.reporting',
] as const;

export type UberAdsScope = (typeof UBER_ADS_SCOPES)[number];

/** Sync and async reporting are gated behind different scopes. */
export const SYNC_REPORTING_SCOPE = 'ads.sync.reporting';
export const ASYNC_REPORTING_SCOPE = 'ads.reporting';
