import type {
  AdAccountsResponse,
  AdGroupsResponse,
  AdsResponse,
  CampaignsResponse,
  CreateAdGroupsRequest,
  CreateAdGroupsResponse,
  CreateAdsRequest,
  CreateAdsResponse,
  CreateCampaignsRequest,
  CreateCampaignsResponse,
  CreateReportRequest,
  CreateReportResponse,
  PageParams,
  ProductsResponse,
  ReportStatusResponse,
  StoresResponse,
  SyncReportRequest,
  SyncReportResponse,
  UpdateAdGroupsRequest,
  UpdateAdGroupsResponse,
  UpdateAdsRequest,
  UpdateAdsResponse,
  UpdateCampaignsRequest,
  UpdateCampaignsResponse,
} from '@/types/api';

/**
 * Typed client for every endpoint in the Uber Ads API.
 *
 * Requests go to this app's proxy at `/api/uber/*`, which attaches the access
 * token server-side. Nothing here needs (or can read) a token.
 *
 * @see https://developer.uber.com/docs/ads/introduction
 */

const PROXY_PREFIX = '/api/uber';

export class UberApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(UberApiError.describe(status, body));
    this.name = 'UberApiError';
    this.status = status;
    this.body = body;
  }

  /** True when the caller should send the user back through the login flow. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** True when the request was rejected for exceeding a rate limit. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  private static describe(status: number, body: unknown): string {
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message = record.message ?? record.error;
      // The proxy reports transport failures as `error` plus a `details` string
      // naming the underlying cause, which is the only actionable part.
      const detail = record.details;
      if (typeof message === 'string') {
        return typeof detail === 'string' && detail !== message
          ? `${message} (${detail})`
          : message;
      }
      if (typeof detail === 'string') return detail;
    }
    return `Uber Ads API request failed with status ${status}`;
  }
}

function withPageParams(path: string, params?: PageParams): string {
  if (!params?.pageToken && !params?.pageLimit) return path;

  const query = new URLSearchParams();
  if (params.pageToken) query.set('page_token', params.pageToken);
  if (params.pageLimit) query.set('page_limit', String(params.pageLimit));
  return `${path}?${query}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  body?: unknown
): Promise<T> {
  const response = await fetch(`${PROXY_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new UberApiError(response.status, parsed);
  }

  return parsed as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST' }, body);
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH' }, body);

const encode = encodeURIComponent;

export const uberAds = {
  /* ---------------------------------------------------------------- */
  /* Ad accounts and stores                                           */
  /* ---------------------------------------------------------------- */

  /** `GET /v1/ads/ad-accounts` — the only endpoint without pagination. */
  getAdAccounts: () => get<AdAccountsResponse>('/v1/ads/ad-accounts'),

  /** `GET /v1/ads/{ad_account_id}/stores` */
  getStores: (accountId: string, page?: PageParams) =>
    get<StoresResponse>(
      withPageParams(`/v1/ads/${encode(accountId)}/stores`, page)
    ),

  /* ---------------------------------------------------------------- */
  /* Campaigns                                                        */
  /* ---------------------------------------------------------------- */

  /** `GET /v1/ads/{account_id}/campaigns` */
  getCampaigns: (accountId: string, page?: PageParams) =>
    get<CampaignsResponse>(
      withPageParams(`/v1/ads/${encode(accountId)}/campaigns`, page)
    ),

  /** `POST /v1/ads/{account_id}/campaigns` — batch create. */
  createCampaigns: (accountId: string, body: CreateCampaignsRequest) =>
    post<CreateCampaignsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns`,
      body
    ),

  /** `PATCH /v1/ads/{account_id}/campaigns` — batch update. */
  updateCampaigns: (accountId: string, body: UpdateCampaignsRequest) =>
    patch<UpdateCampaignsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns`,
      body
    ),

  /* ---------------------------------------------------------------- */
  /* Ad groups                                                        */
  /* ---------------------------------------------------------------- */

  /** `GET /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups` */
  getAdGroups: (accountId: string, campaignId: string, page?: PageParams) =>
    get<AdGroupsResponse>(
      withPageParams(
        `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups`,
        page
      )
    ),

  /** `POST /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups` */
  createAdGroups: (
    accountId: string,
    campaignId: string,
    body: CreateAdGroupsRequest
  ) =>
    post<CreateAdGroupsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups`,
      body
    ),

  /** `PATCH /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups` */
  updateAdGroups: (
    accountId: string,
    campaignId: string,
    body: UpdateAdGroupsRequest
  ) =>
    patch<UpdateAdGroupsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups`,
      body
    ),

  /* ---------------------------------------------------------------- */
  /* Ads                                                              */
  /* ---------------------------------------------------------------- */

  /** `GET /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads` */
  getAds: (
    accountId: string,
    campaignId: string,
    adGroupId: string,
    page?: PageParams
  ) =>
    get<AdsResponse>(
      withPageParams(
        `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups/${encode(adGroupId)}/ads`,
        page
      )
    ),

  /** `POST /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads` */
  createAds: (
    accountId: string,
    campaignId: string,
    adGroupId: string,
    body: CreateAdsRequest
  ) =>
    post<CreateAdsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups/${encode(adGroupId)}/ads`,
      body
    ),

  /** `PATCH /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads` */
  updateAds: (
    accountId: string,
    campaignId: string,
    adGroupId: string,
    body: UpdateAdsRequest
  ) =>
    patch<UpdateAdsResponse>(
      `/v1/ads/${encode(accountId)}/campaigns/${encode(campaignId)}/ad-groups/${encode(adGroupId)}/ads`,
      body
    ),

  /* ---------------------------------------------------------------- */
  /* Products                                                         */
  /* ---------------------------------------------------------------- */

  /** `GET /v1/ads/{account_id}/products` */
  getProducts: (accountId: string, page?: PageParams) =>
    get<ProductsResponse>(
      withPageParams(`/v1/ads/${encode(accountId)}/products`, page)
    ),

  /* ---------------------------------------------------------------- */
  /* Reporting                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * `POST /v1/ads/{account_id}/reporting/sync` — returns rows immediately.
   * Limited to `HOURLY` or `DAILY` granularity; use the async job for wider
   * ranges or `WEEKLY`/`MONTHLY`/`SUMMARY` rollups.
   */
  runSyncReport: (accountId: string, body: SyncReportRequest) =>
    post<SyncReportResponse>(
      `/v1/ads/${encode(accountId)}/reporting/sync`,
      body
    ),

  /** `POST /v1/ads/{account_id}/reporting/report` — queues an async job. */
  createReport: (accountId: string, body: CreateReportRequest) =>
    post<CreateReportResponse>(
      `/v1/ads/${encode(accountId)}/reporting/report`,
      body
    ),

  /**
   * `GET /v1/ads/{account_id}/reporting/{report_id}` — poll for job status.
   * Uber rate-limits this to one request every 10 seconds.
   */
  getReport: (accountId: string, reportId: string) =>
    get<ReportStatusResponse>(
      `/v1/ads/${encode(accountId)}/reporting/${encode(reportId)}`
    ),
};

interface BatchResult {
  results?: Array<{
    success?: { id?: string };
    failure?: { error_code?: string; error_message?: string };
  }>;
}

/**
 * Every write endpoint is a batch operation that reports per-item outcomes
 * inside a `200` response, so an HTTP success does not mean the write worked.
 * Throws if any item failed; otherwise returns the affected IDs.
 */
export function assertBatchSuccess(response: BatchResult): string[] {
  const results = response.results ?? [];

  const failures = results
    .map((result) => result.failure)
    .filter((failure): failure is NonNullable<typeof failure> =>
      Boolean(failure)
    );

  if (failures.length > 0) {
    throw new Error(
      failures
        .map(
          (failure) =>
            `${failure.error_code ?? 'ERROR'}: ${failure.error_message ?? 'Unknown error'}`
        )
        .join('; ')
    );
  }

  return results
    .map((result) => result.success?.id)
    .filter((id): id is string => Boolean(id));
}

/** Fetches every page of a cursor-paginated endpoint. */
export async function collectAllPages<T>(
  fetchPage: (page?: PageParams) => Promise<{
    next_page_token?: { value?: string };
  }>,
  selectItems: (response: never) => T[] | undefined,
  pageLimit?: number
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetchPage({ pageToken, pageLimit });
    items.push(...(selectItems(response as never) ?? []));
    pageToken = response.next_page_token?.value || undefined;
  } while (pageToken);

  return items;
}

export const apiClient = uberAds;
