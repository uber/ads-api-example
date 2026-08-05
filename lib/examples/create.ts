/**
 * Creating a campaign, an ad group, and an ad.
 *
 * The three levels must be created in order — each nests under the previous
 * one's ID. All three endpoints are batch writes that report per-item failures
 * inside an HTTP 200, which `assertBatchSuccess` turns into thrown errors.
 *
 * @see https://developer.uber.com/docs/ads/campaign-management/overview
 */
import { assertBatchSuccess, uberAds } from '@/lib/api';
import { assertAdProductEligible, type AdProduct } from '@/lib/ad-products';
import { toCurrencyAmount } from '@/lib/format';
import type {
  CreateAdGroupsRequest,
  CreateAdsRequest,
  CreateCampaignsRequest,
} from '@/types/api';

type CampaignInput = NonNullable<CreateCampaignsRequest['campaigns']>[number];
type AdGroupInput = NonNullable<CreateAdGroupsRequest['ad_groups']>[number];
type AdInput = NonNullable<CreateAdsRequest['ads']>[number];

type BudgetInput = NonNullable<CampaignInput['budget']>;
type BiddingInput = AdGroupInput['bidding'];
type TargetingInput = NonNullable<AdGroupInput['targeting']>;
type CriterionInput = TargetingInput['criteria'][number];
type DaypartingInput = NonNullable<AdGroupInput['dayparting_schedule']>;

export type BudgetUnit = BudgetInput['unit'];

/** Writes take `EXACT`; reads return `MATCH_TYPE_EXACT`. */
export type KeywordMatchType = 'EXACT' | 'BROAD';

/* -------------------------------------------------------------------------- */
/* Budgets and bidding                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Budgets are optional at both the campaign and ad group level, and an ad
 * group with neither is uncapped.
 */
export function budget(
  amount: number,
  currencyCode: string,
  unit: BudgetUnit = 'BUDGET_UNIT_DAILY'
): BudgetInput {
  return { unit, total: toCurrencyAmount(amount, currencyCode) };
}

export const autoBidding = (): BiddingInput => ({ auto: {} });

export const manualBidding = (
  amount: number,
  currencyCode: string
): BiddingInput => ({
  manual: { bid_amount: toCurrencyAmount(amount, currencyCode) },
});

/** `roasGoal` is a multiplier, e.g. `4` for 4x return on ad spend. */
export const goalBasedBidding = (roasGoal: number): BiddingInput => ({
  goal_based: { roas_goal: roasGoal },
});

/* -------------------------------------------------------------------------- */
/* Targeting                                                                  */
/* -------------------------------------------------------------------------- */

/** Omitting targeting entirely targets all users. */
export function allOf(criteria: CriterionInput[]): TargetingInput {
  return { negation: false, operator: 'AND', criteria };
}

export function anyOf(criteria: CriterionInput[]): TargetingInput {
  return { negation: false, operator: 'OR', criteria };
}

/** Nests a criteria group inside another one. */
export const nested = (targeting: TargetingInput): CriterionInput => ({
  criteria: targeting,
});

/** Only meaningful on Sponsored Search. */
export const keywordTargeting = (
  keywords: string[],
  matchType: KeywordMatchType
): CriterionInput => ({
  keyword_targeting: { keywords, match_type: matchType },
});

export const uberOne = (): CriterionInput => ({ uber_one: {} });

/** Has not ordered from the brand in the last 365 days. */
export const newToBrand = (): CriterionInput => ({ new_to_brand: {} });

/** Has not ordered from this location in the last 365 days. */
export const newToLocation = (): CriterionInput => ({ new_to_location: {} });

/** Ordered from this location within the last 42 days. */
export const existingToLocation = (): CriterionInput => ({
  existing_to_location: {},
});

/** Ordered in the last 365 days but not the last 42. */
export const lapsedToLocation = (): CriterionInput => ({
  lapsed_to_location: {},
});

/**
 * Order count over a trailing window. Bounds are non-inclusive and `-1` means
 * no upper limit; days count backwards from today, so `startDay` is the more
 * recent end of the range.
 */
export const orderFrequency = (
  lowerBound: number,
  upperBound: number,
  startDay: number,
  endDay: number
): CriterionInput => ({
  order_frequency: {
    lower_bound: lowerBound,
    upper_bound: upperBound,
    time_range: { past_days_range: { start_day: startDay, end_day: endDay } },
  },
});

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Dayparting requires exactly seven day schedules, Monday first. Minutes must
 * be divisible by 15, and hour `24` means end of day.
 */
export function everyDayBetween(
  startHour: number,
  endHour: number
): DaypartingInput {
  const day = {
    intervals: [
      {
        start_time: { hour: startHour, minute: 0 },
        end_time: { hour: endHour, minute: 0 },
      },
    ],
  };
  return { dayparting_day_schedule: Array.from({ length: 7 }, () => day) };
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

export interface CampaignOptions {
  name: string;
  /** Shared across every ad group in the campaign. */
  budget?: BudgetInput;
  paused?: boolean;
}

export function buildCampaign({
  name,
  budget: campaignBudget,
  paused = false,
}: CampaignOptions): CampaignInput {
  return {
    name,
    configured_status: paused
      ? 'CAMPAIGN_CONFIGURED_STATUS_PAUSED'
      : 'CAMPAIGN_CONFIGURED_STATUS_ACTIVE',
    ...(campaignBudget ? { budget: campaignBudget } : {}),
  };
}

export interface AdGroupOptions {
  name: string;
  adProduct: AdProduct;
  /** At least one is required. */
  storeIds: string[];
  bidding: BiddingInput;
  /** RFC 3339. Defaults to now. */
  startTime?: string;
  /** RFC 3339. Omit to run indefinitely. */
  endTime?: string;
  budget?: BudgetInput;
  targeting?: TargetingInput;
  daypartingSchedule?: DaypartingInput;
  paused?: boolean;
}

export function buildAdGroup({
  name,
  adProduct,
  storeIds,
  bidding,
  startTime,
  endTime,
  budget: adGroupBudget,
  targeting,
  daypartingSchedule,
  paused = false,
}: AdGroupOptions): AdGroupInput {
  return {
    name,
    ad_product: adProduct,
    configured_status: paused
      ? 'AD_GROUP_CONFIGURED_STATUS_PAUSED'
      : 'AD_GROUP_CONFIGURED_STATUS_ACTIVE',
    schedule: {
      start_time: startTime ?? new Date().toISOString(),
      ...(endTime ? { end_time: endTime } : {}),
    },
    bidding,
    ad_subjects: { stores: { store_ids: storeIds } },
    ...(adGroupBudget ? { budget: adGroupBudget } : {}),
    ...(targeting ? { targeting } : {}),
    ...(daypartingSchedule ? { dayparting_schedule: daypartingSchedule } : {}),
  };
}

/**
 * An ad is only a name today — Uber attaches a default creative, and the ad
 * inherits targeting, bidding, and budget from its ad group. An ad group with
 * no ads will not serve.
 */
export function buildAd(name: string): AdInput {
  return { name };
}

/* -------------------------------------------------------------------------- */
/* End-to-end example                                                         */
/* -------------------------------------------------------------------------- */

export interface CreateCampaignExample {
  accountId: string;
  /** From `AdAccount.account_type`, checked before anything is created. */
  accountType: string | undefined;
  currencyCode: string;
  adProduct: AdProduct;
  campaignName: string;
  adGroupName: string;
  adName: string;
  storeIds: string[];
  dailyBudget: number;
  bidding?: BiddingInput;
  targeting?: TargetingInput;
  daypartingSchedule?: DaypartingInput;
  paused?: boolean;
}

export interface CreatedCampaign {
  campaignId: string;
  adGroupId: string;
  adId: string;
}

/**
 * There is no transaction across the three calls: if the ad group fails, the
 * campaign already created still exists.
 */
export async function createCampaignWithAdGroupAndAd({
  accountId,
  accountType,
  currencyCode,
  adProduct,
  campaignName,
  adGroupName,
  adName,
  storeIds,
  dailyBudget,
  bidding = autoBidding(),
  targeting,
  daypartingSchedule,
  paused = true,
}: CreateCampaignExample): Promise<CreatedCampaign> {
  assertAdProductEligible(accountType, adProduct);

  if (storeIds.length === 0) {
    throw new Error(
      'An ad group needs at least one store. Fetch them from GET /v1/ads/{account_id}/stores.'
    );
  }

  const [campaignId] = assertBatchSuccess(
    await uberAds.createCampaigns(accountId, {
      campaigns: [
        buildCampaign({
          name: campaignName,
          budget: budget(dailyBudget, currencyCode),
          paused,
        }),
      ],
    })
  );

  const [adGroupId] = assertBatchSuccess(
    await uberAds.createAdGroups(accountId, campaignId, {
      ad_groups: [
        buildAdGroup({
          name: adGroupName,
          adProduct,
          storeIds,
          bidding,
          targeting,
          daypartingSchedule,
          paused,
        }),
      ],
    })
  );

  const [adId] = assertBatchSuccess(
    await uberAds.createAds(accountId, campaignId, adGroupId, {
      ads: [buildAd(adName)],
    })
  );

  return { campaignId, adGroupId, adId };
}

/**
 * The store itself is promoted, so there is no query to match and targeting is
 * audience-based. Available to `OFD` and `USER_STORES_GROUP`.
 */
export function sponsoredListingExample(
  base: Omit<CreateCampaignExample, 'adProduct' | 'targeting'>
): CreateCampaignExample {
  return {
    ...base,
    adProduct: 'SPONSORED_LISTING',
    targeting: allOf([newToBrand()]),
  };
}

/**
 * Serves against a customer's search, so the ad group needs keywords. `BROAD`
 * picks up variations, `EXACT` matches the term as typed. `OFD` only.
 */
export function sponsoredSearchExample(
  base: Omit<CreateCampaignExample, 'adProduct' | 'targeting'>,
  keywords: string[],
  matchType: KeywordMatchType = 'BROAD'
): CreateCampaignExample {
  return {
    ...base,
    adProduct: 'SPONSORED_SEARCH',
    targeting: allOf([keywordTargeting(keywords, matchType)]),
  };
}
