'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdGroup, Bidding, Campaign, TargetingCriteria } from '@/types/api';
import { uberAds } from '@/lib/api';
import {
  getStatusBadgeColor,
  getStatusLabel,
  isActive,
  normalizeStatus,
} from '@/lib/status-utils';
import { formatBudget, formatCurrency, formatDateTime } from '@/lib/format';
import ErrorState from '@/components/ui/ErrorState';

interface AdGroupsViewProps {
  campaign: Campaign;
  accountId: string;
  onAdGroupClick?: (adGroup: AdGroup) => void;
}

/** Keys of the `TargetingCriterion` oneOf, mapped to display labels. */
const TARGETING_LABELS: Record<string, string> = {
  uber_one: 'Uber One',
  order_frequency: 'Order frequency',
  keyword_targeting: 'Keywords',
  custom_audience: 'Custom audience',
  new_to_brand: 'New to brand',
  new_to_location: 'New to location',
  existing_to_location: 'Existing to location',
  lapsed_to_location: 'Lapsed to location',
  criteria: 'Nested criteria',
};

function describeTargeting(targeting?: TargetingCriteria): string {
  const criteria = targeting?.criteria;
  if (!criteria?.length) return 'No targeting';

  const labels = new Set<string>();
  for (const criterion of criteria) {
    for (const key of Object.keys(criterion)) {
      if (TARGETING_LABELS[key]) labels.add(TARGETING_LABELS[key]);
    }
  }

  return labels.size > 0 ? [...labels].join(', ') : 'General targeting';
}

function describeBidding(bidding?: Bidding): string {
  if (!bidding) return '—';
  if ('auto' in bidding && bidding.auto) return 'Auto';
  if ('manual' in bidding && bidding.manual) {
    return `Manual ${formatCurrency(bidding.manual.bid_amount)}`;
  }
  if ('goal_based' in bidding && bidding.goal_based) {
    return `Goal-based ${bidding.goal_based.roas_goal}x ROAS`;
  }
  return '—';
}

function CampaignSummary({ campaign }: { campaign: Campaign }) {
  const facts = [
    { label: 'Budget', value: formatBudget(campaign.budget) },
    {
      label: 'Created',
      value: formatDateTime(campaign.created_at),
      caption: campaign.created_by_email,
    },
    {
      label: 'Last updated',
      value: formatDateTime(campaign.updated_at),
      caption: campaign.updated_by_email,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {campaign.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Campaign ID: {campaign.campaign_id}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(campaign.effective_status)}`}
        >
          {getStatusLabel(campaign.effective_status)}
        </span>
      </div>

      {campaign.effective_status_reasons?.length ? (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Not serving:{' '}
          {campaign.effective_status_reasons.map(getStatusLabel).join(', ')}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm font-medium text-gray-700">{fact.label}</dt>
            <dd className="mt-1 text-sm text-gray-900">{fact.value}</dd>
            {fact.caption && (
              <dd className="text-sm text-gray-500">by {fact.caption}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

type SortField = 'name' | 'status' | 'budget' | 'ads';

export default function AdGroupsView({
  campaign,
  accountId,
  onAdGroupClick,
}: AdGroupsViewProps) {
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAscending, setSortAscending] = useState(true);

  const campaignId = campaign.campaign_id;

  const loadAdGroups = useCallback(
    async (pageToken?: string) => {
      if (!campaignId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await uberAds.getAdGroups(accountId, campaignId, {
          pageToken,
        });
        const page = response.ad_groups ?? [];
        setAdGroups((previous) => (pageToken ? [...previous, ...page] : page));
        setNextPageToken(response.next_page_token?.value || null);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to load ad groups.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, campaignId]
  );

  useEffect(() => {
    void loadAdGroups();
  }, [loadAdGroups]);

  const sortedAdGroups = useMemo(() => {
    const direction = sortAscending ? 1 : -1;

    const key = (adGroup: AdGroup): string | number => {
      switch (sortField) {
        case 'status':
          return normalizeStatus(adGroup.effective_status);
        case 'budget':
          return Number(adGroup.budget?.total?.amount_e5 ?? 0);
        case 'ads':
          return adGroup.ads?.length ?? 0;
        default:
          return adGroup.name?.toLowerCase() ?? '';
      }
    };

    return [...adGroups].sort((a, b) => {
      const left = key(a);
      const right = key(b);
      if (left < right) return -direction;
      if (left > right) return direction;
      return 0;
    });
  }, [adGroups, sortField, sortAscending]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortAscending((ascending) => !ascending);
    } else {
      setSortField(field);
      setSortAscending(true);
    }
  };

  const sortableHeader = (field: SortField, label: string) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => toggleSort(field)}
      aria-sort={
        sortField === field
          ? sortAscending
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <span>{sortAscending ? '▲' : '▼'}</span>}
      </span>
    </th>
  );

  if (isLoading && adGroups.length === 0) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-32 skeleton-shimmer rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load ad groups"
        message={error}
        onRetry={() => void loadAdGroups()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CampaignSummary campaign={campaign} />

      {adGroups.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">No ad groups</h3>
          <p className="mt-2 text-gray-600">
            This campaign has no ad groups yet.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {sortableHeader('name', 'Ad group')}
                  {sortableHeader('status', 'Status')}
                  {sortableHeader('budget', 'Budget')}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bidding
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Targeting
                  </th>
                  {sortableHeader('ads', 'Ads')}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAdGroups.map((adGroup) => (
                  <tr key={adGroup.ad_group_id} className="table-row">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => onAdGroupClick?.(adGroup)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-900 text-left"
                      >
                        {adGroup.name}
                      </button>
                      <div className="text-xs text-gray-500">
                        {adGroup.ad_group_id}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(adGroup.effective_status)}`}
                      >
                        {getStatusLabel(adGroup.effective_status)}
                      </span>
                      {adGroup.configured_status !==
                        adGroup.effective_status && (
                        <div className="text-xs text-gray-500 mt-1">
                          Configured:{' '}
                          {getStatusLabel(adGroup.configured_status)}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatBudget(adGroup.budget)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {describeBidding(adGroup.bidding)}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {describeTargeting(adGroup.targeting)}
                      {adGroup.targeting?.negation && (
                        <div className="text-xs text-red-600">Exclusion</div>
                      )}
                      {adGroup.subjects?.stores?.store_ids?.length ? (
                        <div className="text-xs text-gray-500">
                          {adGroup.subjects.stores.store_ids.length} store(s)
                        </div>
                      ) : null}
                    </td>

                    {/* The ad-groups response embeds ad summaries, so listing
                        them here costs no extra request. */}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {adGroup.ads?.length ? (
                        <div className="flex flex-wrap gap-1 max-w-56">
                          {adGroup.ads.slice(0, 3).map((ad) => (
                            <button
                              key={ad.ad_id}
                              onClick={() => onAdGroupClick?.(adGroup)}
                              title={ad.ad_id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                            >
                              <span className="truncate max-w-32">
                                {ad.name || ad.ad_id}
                              </span>
                            </button>
                          ))}
                          {adGroup.ads.length > 3 && (
                            <button
                              onClick={() => onAdGroupClick?.(adGroup)}
                              className="text-xs text-gray-500 hover:text-gray-900"
                            >
                              +{adGroup.ads.length - 3} more
                            </button>
                          )}
                        </div>
                      ) : (
                        <span
                          className="text-xs text-amber-700"
                          title="An ad group with no ads will not serve."
                        >
                          No ads
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDateTime(adGroup.schedule?.start_time)}
                      <div className="text-xs text-gray-500">
                        to{' '}
                        {adGroup.schedule?.end_time
                          ? formatDateTime(adGroup.schedule.end_time)
                          : 'no end date'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <span>
              {adGroups.length} ad group{adGroups.length === 1 ? '' : 's'} loaded
              {' · '}
              {adGroups.filter((group) => isActive(group.effective_status))
                .length}{' '}
              active
            </span>
            {nextPageToken && (
              <button
                onClick={() => void loadAdGroups(nextPageToken)}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                {isLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
