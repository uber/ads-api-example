'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ErrorState from '@/components/ui/ErrorState';
import { collectAllPages, uberAds } from '@/lib/api';
import type { Store } from '@/types/api';
import {
  AD_PRODUCTS,
  AD_PRODUCT_DEFINITIONS,
  eligibleAdProducts,
  type AdProduct,
} from '@/lib/ad-products';
import {
  allOf,
  autoBidding,
  buildAd,
  buildAdGroup,
  buildCampaign,
  budget,
  createCampaignWithAdGroupAndAd,
  everyDayBetween,
  existingToLocation,
  goalBasedBidding,
  keywordTargeting,
  lapsedToLocation,
  manualBidding,
  newToBrand,
  newToLocation,
  uberOne,
  type CreatedCampaign,
  type KeywordMatchType,
} from '@/lib/examples/create';

type BiddingMode = 'auto' | 'manual' | 'goal_based';

const AUDIENCES = {
  uber_one: { label: 'Uber One members', build: uberOne },
  new_to_brand: { label: 'New to brand (365d)', build: newToBrand },
  new_to_location: { label: 'New to location (365d)', build: newToLocation },
  existing_to_location: {
    label: 'Ordered recently (42d)',
    build: existingToLocation,
  },
  lapsed_to_location: { label: 'Lapsed (365d, not 42d)', build: lapsedToLocation },
} as const;

type AudienceKey = keyof typeof AUDIENCES;

export default function NewCampaignPage() {
  const router = useRouter();
  const { selectedAdAccount, hasScope } = useAuth();
  const canWrite = hasScope('ads.campaigns.write');

  const accountId = selectedAdAccount?.ad_account_id;
  const accountType = selectedAdAccount?.account_type;
  const currencyCode = selectedAdAccount?.currency_code ?? 'USD';
  const allowed = eligibleAdProducts(accountType);

  const [adProduct, setAdProduct] = useState<AdProduct | null>(null);
  const [campaignName, setCampaignName] = useState('Example campaign');
  const [adGroupName, setAdGroupName] = useState('Example ad group');
  const [adName, setAdName] = useState('Example ad');
  const [dailyBudget, setDailyBudget] = useState(25);
  const [paused, setPaused] = useState(true);

  const [stores, setStores] = useState<Store[]>([]);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [storeIds, setStoreIds] = useState<string[]>([]);

  const [biddingMode, setBiddingMode] = useState<BiddingMode>('auto');
  const [bidAmount, setBidAmount] = useState(1.5);
  const [roasGoal, setRoasGoal] = useState(4);

  const [keywords, setKeywords] = useState('pizza, late night delivery');
  const [matchType, setMatchType] = useState<KeywordMatchType>('BROAD');
  const [audiences, setAudiences] = useState<AudienceKey[]>(['new_to_brand']);

  const [useDayparting, setUseDayparting] = useState(false);
  const [dayStart, setDayStart] = useState(6);
  const [dayEnd, setDayEnd] = useState(22);

  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<CreatedCampaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdProduct((current) =>
      current && allowed.includes(current) ? current : (allowed[0] ?? null)
    );
  }, [allowed]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    collectAllPages<Store>(
      (page) => uberAds.getStores(accountId, page),
      (response: { stores?: Store[] }) => response.stores
    )
      .then((all) => {
        if (!cancelled) setStores(all);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setStoresError(
            cause instanceof Error ? cause.message : 'Failed to load stores.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const keywordList = useMemo(
    () =>
      keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    [keywords]
  );

  const bidding = useMemo(() => {
    if (biddingMode === 'manual') return manualBidding(bidAmount, currencyCode);
    if (biddingMode === 'goal_based') return goalBasedBidding(roasGoal);
    return autoBidding();
  }, [biddingMode, bidAmount, roasGoal, currencyCode]);

  const targeting = useMemo(() => {
    if (adProduct === 'SPONSORED_SEARCH') {
      return keywordList.length > 0
        ? allOf([keywordTargeting(keywordList, matchType)])
        : undefined;
    }
    return audiences.length > 0
      ? allOf(audiences.map((key) => AUDIENCES[key].build()))
      : undefined;
  }, [adProduct, keywordList, matchType, audiences]);

  const daypartingSchedule = useDayparting
    ? everyDayBetween(dayStart, dayEnd)
    : undefined;

  const validationError = !canWrite
    ? 'This Uber token was not granted the ads.campaigns.write scope.'
    : !selectedAdAccount
      ? 'Select an ad account first.'
      : !adProduct
        ? `Ad accounts of type ${accountType ?? 'UNKNOWN'} cannot create campaigns.`
        : storeIds.length === 0
          ? 'Select at least one store.'
          : adProduct === 'SPONSORED_SEARCH' && keywordList.length === 0
            ? 'Sponsored Search needs at least one keyword.'
            : useDayparting && dayEnd <= dayStart
              ? 'Dayparting end hour must be after the start hour.'
              : null;

  // Shows exactly what the three calls will send, which is the point of the example.
  const preview = useMemo(() => {
    if (!adProduct) return null;
    return {
      'POST /campaigns': {
        campaigns: [
          buildCampaign({
            name: campaignName,
            budget: budget(dailyBudget, currencyCode),
            paused,
          }),
        ],
      },
      'POST /campaigns/{campaign_id}/ad-groups': {
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
      },
      'POST /ad-groups/{ad_group_id}/ads': { ads: [buildAd(adName)] },
    };
  }, [
    adProduct,
    campaignName,
    adGroupName,
    adName,
    dailyBudget,
    currencyCode,
    paused,
    storeIds,
    bidding,
    targeting,
    daypartingSchedule,
  ]);

  const submit = async () => {
    if (!accountId || !adProduct || validationError) return;

    setIsCreating(true);
    setError(null);
    setCreated(null);

    try {
      setCreated(
        await createCampaignWithAdGroupAndAd({
          accountId,
          accountType,
          currencyCode,
          adProduct,
          campaignName,
          adGroupName,
          adName,
          storeIds,
          dailyBudget,
          bidding,
          targeting,
          daypartingSchedule,
          paused,
        })
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to create the campaign.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStore = (id: string) => {
    setStoreIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const toggleAudience = (key: AudienceKey) => {
    setAudiences((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const fieldClass =
    'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <Link
            href="/dashboard/campaigns"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Create a campaign
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Creates a campaign, one ad group, and one ad in three sequential
            calls.
          </p>
        </div>

        {!canWrite && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            This session was not granted{' '}
            <code className="text-xs">ads.campaigns.write</code>, so these
            requests will be rejected.
          </div>
        )}

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Ad product</h2>
            <p className="text-sm text-gray-500">
              This ad account is type{' '}
              <code className="text-xs">{accountType ?? 'UNKNOWN'}</code>, which
              may run{' '}
              {allowed.length > 0
                ? allowed.map((id) => AD_PRODUCT_DEFINITIONS[id].label).join(' and ')
                : 'no ad products'}
              .
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AD_PRODUCTS.map((id) => {
              const definition = AD_PRODUCT_DEFINITIONS[id];
              const eligible = allowed.includes(id);
              const selected = adProduct === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAdProduct(id)}
                  disabled={!eligible}
                  className={`rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-black ring-1 ring-black'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <span className="block text-sm font-medium text-gray-900">
                    {definition.label}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {definition.description}
                  </span>
                  <span className="mt-2 block text-xs text-gray-400">
                    {eligible
                      ? definition.placements.join(' · ')
                      : `Not available to ${accountType ?? 'UNKNOWN'} accounts`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Names and budget</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Campaign name
              </span>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Ad group name
              </span>
              <input
                value={adGroupName}
                onChange={(event) => setAdGroupName(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Ad name</span>
              <input
                value={adName}
                onChange={(event) => setAdName(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Daily budget ({currencyCode})
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={dailyBudget}
                onChange={(event) => setDailyBudget(Number(event.target.value))}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={paused}
              onChange={(event) => setPaused(event.target.checked)}
              className="rounded border-gray-300"
            />
            Create paused so nothing spends until you review it
          </label>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Stores</h2>
            <p className="text-sm text-gray-500">
              The ad group&apos;s <code className="text-xs">ad_subjects</code>.
              At least one is required.
            </p>
          </div>

          {storesError ? (
            <p className="text-sm text-red-600">{storesError}</p>
          ) : stores.length === 0 ? (
            <p className="text-sm text-gray-500">Loading stores…</p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
              {stores.map((store) => (
                <label
                  key={store.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={storeIds.includes(store.id ?? '')}
                    onChange={() => toggleStore(store.id ?? '')}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-900">{store.name}</span>
                  <span className="ml-auto font-mono text-xs text-gray-400">
                    {store.id}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Bidding</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['auto', 'Auto'],
                ['manual', 'Manual bid'],
                ['goal_based', 'ROAS goal'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBiddingMode(value)}
                aria-pressed={biddingMode === value}
                className={`rounded-full border px-4 py-1 text-xs transition-colors ${
                  biddingMode === value
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {biddingMode === 'manual' && (
            <label className="block max-w-xs">
              <span className="text-sm font-medium text-gray-700">
                Bid amount ({currencyCode})
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={bidAmount}
                onChange={(event) => setBidAmount(Number(event.target.value))}
                className={fieldClass}
              />
            </label>
          )}

          {biddingMode === 'goal_based' && (
            <label className="block max-w-xs">
              <span className="text-sm font-medium text-gray-700">
                ROAS goal (multiplier)
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={roasGoal}
                onChange={(event) => setRoasGoal(Number(event.target.value))}
                className={fieldClass}
              />
            </label>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Targeting</h2>
            <p className="text-sm text-gray-500">
              {adProduct === 'SPONSORED_SEARCH'
                ? 'Sponsored Search matches a customer’s query, so it targets keywords.'
                : 'Sponsored Listing has no query to match, so it targets audiences.'}
            </p>
          </div>

          {adProduct === 'SPONSORED_SEARCH' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-gray-700">
                  Keywords (comma separated)
                </span>
                <input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Match type
                </span>
                <select
                  value={matchType}
                  onChange={(event) =>
                    setMatchType(event.target.value as KeywordMatchType)
                  }
                  className={fieldClass}
                >
                  <option value="BROAD">BROAD</option>
                  <option value="EXACT">EXACT</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AUDIENCES) as AudienceKey[]).map((key) => {
                const selected = audiences.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAudience(key)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {AUDIENCES[key].label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useDayparting}
                onChange={(event) => setUseDayparting(event.target.checked)}
                className="rounded border-gray-300"
              />
              Limit delivery to certain hours
            </label>

            {useDayparting && (
              <div className="flex items-center gap-3 text-sm">
                <select
                  value={dayStart}
                  onChange={(event) => setDayStart(Number(event.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">to</span>
                <select
                  value={dayEnd}
                  onChange={(event) => setDayEnd(Number(event.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1"
                >
                  {Array.from({ length: 24 }, (_, index) => index + 1).map(
                    (hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, '0')}:00
                      </option>
                    )
                  )}
                </select>
                <span className="text-gray-500">every day</span>
              </div>
            )}
          </div>
        </section>

        {preview && (
          <details className="bg-white border border-gray-200 rounded-lg p-6">
            <summary className="cursor-pointer text-sm font-medium text-gray-900">
              Request preview
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-md bg-gray-50 p-4 text-xs text-gray-800">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </details>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => void submit()}
            disabled={isCreating || Boolean(validationError)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-40"
          >
            {isCreating ? 'Creating…' : 'Create campaign'}
          </button>
          {validationError && (
            <span className="text-sm text-gray-500">{validationError}</span>
          )}
        </div>

        {error && (
          <ErrorState
            title="Create failed"
            message={error}
            onRetry={() => void submit()}
          />
        )}

        {created && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-3">
            <h2 className="text-sm font-medium text-green-900">
              Created {paused ? '(paused)' : '(active)'}
            </h2>
            <dl className="space-y-1 text-sm text-green-900">
              {(
                [
                  ['Campaign', created.campaignId],
                  ['Ad group', created.adGroupId],
                  ['Ad', created.adId],
                ] as const
              ).map(([label, id]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-24 text-green-700">{label}</dt>
                  <dd className="font-mono text-xs">{id}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={() =>
                router.push(
                  `/dashboard/campaigns?campaignId=${created.campaignId}`
                )
              }
              className="text-sm font-medium text-green-900 underline"
            >
              View campaign
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
