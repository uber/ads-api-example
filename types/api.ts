/**
 * Friendly aliases over the types generated from the Uber Ads OpenAPI spec.
 *
 * `types/uber-ads.ts` is generated and should never be edited by hand; run
 * `npm run generate:types` to refresh it. This file is the stable surface the
 * rest of the app imports, so a regenerated spec surfaces as compile errors
 * here rather than scattered across every component.
 */
import type { components, operations } from './uber-ads';

type Schemas = components['schemas'];

type JsonBody<T> = T extends { content: { 'application/json': infer B } }
  ? B
  : never;

type Ok<T extends keyof operations> = JsonBody<
  operations[T]['responses'][200]
>;

type RequestBody<T extends keyof operations> = operations[T] extends {
  requestBody: infer R;
}
  ? JsonBody<R>
  : never;

/* -------------------------------------------------------------------------- */
/* Ad accounts and stores                                                     */
/* -------------------------------------------------------------------------- */

export type AdAccount = Schemas['GetAdAccounts_AdAccount'];
export type AdAccountsResponse = Ok<'get-ad-accounts'>;
export type Store = Schemas['GetStores_Store'];
export type StoresResponse = Ok<'get-stores'>;

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export type Campaign = Schemas['GetCampaigns_Campaign'];
export type CampaignsResponse = Ok<'get-campaigns'>;
export type AdGroupSummary = Schemas['GetCampaigns_AdGroupSummary'];
export type Budget = Schemas['GetCampaigns_Budget'];
export type CurrencyAmount = Schemas['GetCampaigns_CurrencyAmount'];

export type CreateCampaignsRequest = RequestBody<'create-campaigns'>;
export type CreateCampaignsResponse = Ok<'create-campaigns'>;
export type UpdateCampaignsRequest = RequestBody<'update-campaigns'>;
export type UpdateCampaignsResponse = Ok<'update-campaigns'>;

/* -------------------------------------------------------------------------- */
/* Ad groups                                                                  */
/* -------------------------------------------------------------------------- */

export type AdGroup = Schemas['GetAdGroups_AdGroup'];
export type AdGroupsResponse = Ok<'get-ad-groups'>;
export type AdSummary = Schemas['GetAdGroups_AdSummary'];
export type Bidding = Schemas['GetAdGroups_Bidding'];
export type TargetingCriteria = Schemas['GetAdGroups_TargetingCriteria'];
export type DaypartingSchedule = Schemas['GetAdGroups_DaypartingSchedule'];

export type CreateAdGroupsRequest = RequestBody<'create-ad-groups'>;
export type CreateAdGroupsResponse = Ok<'create-ad-groups'>;
export type UpdateAdGroupsRequest = RequestBody<'update-ad-groups'>;
export type UpdateAdGroupsResponse = Ok<'update-ad-groups'>;

/* -------------------------------------------------------------------------- */
/* Ads                                                                        */
/* -------------------------------------------------------------------------- */

export type Ad = Schemas['GetAds_Ad'];
export type AdsResponse = Ok<'get-ads'>;
export type CreateAdsRequest = RequestBody<'create-ads'>;
export type CreateAdsResponse = Ok<'create-ads'>;
export type UpdateAdsRequest = RequestBody<'update-ads'>;
export type UpdateAdsResponse = Ok<'update-ads'>;

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export type Product = Schemas['GetProducts_Product'];
export type ProductsResponse = Ok<'get-products'>;

/* -------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* -------------------------------------------------------------------------- */

export type CreateReportRequest = RequestBody<'create-reports'>;
export type CreateReportResponse = Ok<'create-reports'>;
export type ReportStatusResponse = Ok<'get-report'>;
export type SyncReportRequest = RequestBody<'sync-report'>;
export type SyncReportResponse = Ok<'sync-report'>;
export type ReportColumnDefinition = Schemas['SyncReport_ColumnDefinition'];
export type ReportRow = Schemas['SyncReport_ReportRow'];

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

/** Uber returns pagination cursors as `{ value: "..." }`, not a bare string. */
export type PageToken = Schemas['GetCampaigns_PageToken'];

export interface PageParams {
  /** Cursor taken from a previous response's `next_page_token.value`. */
  pageToken?: string;
  /** Results per page. The API caps this at 2000. */
  pageLimit?: number;
}
