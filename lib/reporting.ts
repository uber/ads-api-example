/**
 * Reporting constants.
 *
 * The OpenAPI spec types `report_type` and the column names as free-form
 * strings, so these lists come from the reporting documentation.
 * @see https://developer.uber.com/docs/ads/reporting-metrics/overview
 */

export interface ReportTypeDefinition {
  id: string;
  label: string;
  /** Whether `POST /reporting/sync` accepts this report type. */
  supportsSync: boolean;
  dimensions: string[];
  metrics: string[];
}

const AD_PERFORMANCE_METRICS = [
  'impressions',
  'clicks',
  'click_through_rate',
  'ad_spend',
  'cost_per_click',
  'orders_7d_on_click_date',
  'sales_7d_on_click_date',
  'roas_7d_on_click_date',
];

export const REPORT_TYPES: ReportTypeDefinition[] = [
  {
    id: 'AD_PERFORMANCE',
    label: 'Ad performance',
    supportsSync: true,
    dimensions: [
      'campaign_id',
      'ad_group_id',
      'currency_code',
      'placement_l1',
      'placement_l2',
    ],
    metrics: AD_PERFORMANCE_METRICS,
  },
  {
    id: 'AD_PERFORMANCE_BY_LOCATION',
    label: 'Ad performance by location',
    supportsSync: true,
    dimensions: ['campaign_id', 'ad_group_id', 'location_id', 'currency_code'],
    metrics: AD_PERFORMANCE_METRICS,
  },
  {
    id: 'AD_PERFORMANCE_BY_KEYWORD',
    label: 'Ad performance by keyword',
    supportsSync: false,
    dimensions: ['campaign_id', 'ad_group_id', 'keyword', 'match_type'],
    metrics: AD_PERFORMANCE_METRICS,
  },
  {
    id: 'AD_PERFORMANCE_BY_AUDIENCE_TENURE',
    label: 'Ad performance by audience tenure',
    supportsSync: false,
    dimensions: ['campaign_id', 'ad_group_id', 'audience_segment'],
    metrics: AD_PERFORMANCE_METRICS,
  },
  {
    id: 'AD_KEYWORD_IDENTIFICATION',
    label: 'Keyword identification',
    supportsSync: false,
    dimensions: ['ad_account_id', 'search_term'],
    metrics: ['impressions', 'clicks', 'ad_spend'],
  },
];

/** `HOURLY` is sync-only; `WEEKLY`/`MONTHLY`/`SUMMARY` are async-only. */
export const SYNC_TIME_UNITS = ['HOURLY', 'DAILY'] as const;
export const ASYNC_TIME_UNITS = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'SUMMARY',
] as const;

/**
 * Metrics that remain available at `HOURLY` granularity. Requesting anything
 * else alongside `HOURLY` is rejected by the API.
 */
export const HOURLY_SAFE_METRICS = [
  'impressions',
  'clicks',
  'ad_spend',
  'click_through_rate',
  'cost_per_click',
];

/**
 * Sync reporting windows enforced by the API: 24 hours of hourly data (last
 * 7 days), or 30 days of daily data (last 2 years).
 */
export const SYNC_MAX_RANGE_DAYS = { HOURLY: 1, DAILY: 30 } as const;

export const FILTER_OPERATORS = ['EQUAL', 'NOT_EQUAL', 'IN'] as const;

/** Formats a date as the RFC 3339 timestamp the reporting API expects. */
export function toReportTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 10)}T00:00:00Z`;
}

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}
