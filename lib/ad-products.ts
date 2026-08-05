/**
 * Ad product rules.
 *
 * @see https://developer.uber.com/docs/ads/campaign-management/ad-products
 * @see https://developer.uber.com/docs/ads/references/models/v1/ad-account
 */
import type { AdAccount } from '@/types/api';

export const AD_PRODUCTS = ['SPONSORED_LISTING', 'SPONSORED_SEARCH'] as const;
export type AdProduct = (typeof AD_PRODUCTS)[number];

export type AccountType = NonNullable<AdAccount['account_type']>;

export interface AdProductDefinition {
  id: AdProduct;
  label: string;
  description: string;
  placements: string[];
  /** Only products that serve against a query can match keywords. */
  supportsKeywordTargeting: boolean;
}

export const AD_PRODUCT_DEFINITIONS: Record<AdProduct, AdProductDefinition> = {
  SPONSORED_LISTING: {
    id: 'SPONSORED_LISTING',
    label: 'Sponsored Listing',
    description:
      "Elevates a store's visibility by featuring it prominently across the Uber Eats app.",
    placements: [
      'Uber Eats home feed',
      'Uber Eats search results',
      'Storefront pages',
      'Pickup filter results',
    ],
    supportsKeywordTargeting: false,
  },
  SPONSORED_SEARCH: {
    id: 'SPONSORED_SEARCH',
    label: 'Sponsored Search',
    description:
      'Serves only when a customer is actively searching, so the ad matches user intent.',
    placements: [
      'Uber Eats search results only',
      'Cuisine category filter results',
    ],
    supportsKeywordTargeting: true,
  },
};

/** Campaign-creation eligibility matrix from the Ad Products docs. */
const ELIGIBLE_AD_PRODUCTS: Record<AccountType, readonly AdProduct[]> = {
  OFD: ['SPONSORED_LISTING', 'SPONSORED_SEARCH'],
  USER_STORES_GROUP: ['SPONSORED_LISTING'],
  AGENCY: [],
  INTERNAL: [],
  UNKNOWN: [],
};

/** Shared so callers can use the result as a stable dependency. */
const NONE: readonly AdProduct[] = [];

/**
 * Takes a plain string because the AdAccount docs list a `CPG` type the spec's
 * enum omits, so an account can report a type this build does not know.
 */
export function eligibleAdProducts(
  accountType: string | undefined
): readonly AdProduct[] {
  if (!accountType) return NONE;
  return ELIGIBLE_AD_PRODUCTS[accountType as AccountType] ?? NONE;
}

export function isAdProductEligible(
  accountType: string | undefined,
  adProduct: AdProduct
): boolean {
  return eligibleAdProducts(accountType).includes(adProduct);
}

export function assertAdProductEligible(
  accountType: string | undefined,
  adProduct: AdProduct
): void {
  if (isAdProductEligible(accountType, adProduct)) return;

  const allowed = eligibleAdProducts(accountType);
  const label = AD_PRODUCT_DEFINITIONS[adProduct].label;

  throw new Error(
    allowed.length === 0
      ? `Ad accounts of type ${accountType ?? 'UNKNOWN'} cannot create campaigns. ` +
        `See https://developer.uber.com/docs/ads/campaign-management/ad-products`
      : `Ad accounts of type ${accountType} cannot run ${label}. ` +
        `Eligible products: ${allowed.join(', ')}.`
  );
}
