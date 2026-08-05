'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Ad, AdGroup } from '@/types/api';
import { uberAds } from '@/lib/api';
import { getStatusBadgeColor, getStatusLabel } from '@/lib/status-utils';
import { formatBudget, formatDateTime, humanizeEnum } from '@/lib/format';
import ErrorState from '@/components/ui/ErrorState';

interface AdUnitsViewProps {
  adGroup: AdGroup;
  campaignId: string;
  accountId: string;
}

function AdGroupSummary({ adGroup }: { adGroup: AdGroup }) {
  const facts = [
    { label: 'Budget', value: formatBudget(adGroup.budget) },
    { label: 'Ad product', value: humanizeEnum(adGroup.ad_product) },
    { label: 'Starts', value: formatDateTime(adGroup.schedule?.start_time) },
    {
      label: 'Ends',
      value: adGroup.schedule?.end_time
        ? formatDateTime(adGroup.schedule.end_time)
        : 'No end date',
    },
    {
      label: 'Stores',
      value: String(adGroup.subjects?.stores?.store_ids?.length ?? 0),
    },
    {
      label: 'Dayparting',
      value: adGroup.dayparting_schedule?.dayparting_day_schedule?.length
        ? `${adGroup.dayparting_schedule.dayparting_day_schedule.reduce(
            (total, day) => total + (day.intervals?.length ?? 0),
            0
          )} intervals`
        : 'None',
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {adGroup.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Ad group ID: {adGroup.ad_group_id}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(adGroup.effective_status)}`}
        >
          {getStatusLabel(adGroup.effective_status)}
        </span>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm font-medium text-gray-700">{fact.label}</dt>
            <dd className="mt-1 text-sm text-gray-900">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function AdUnitsView({
  adGroup,
  campaignId,
  accountId,
}: AdUnitsViewProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const adGroupId = adGroup.ad_group_id;

  const loadAds = useCallback(
    async (pageToken?: string) => {
      if (!adGroupId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await uberAds.getAds(
          accountId,
          campaignId,
          adGroupId,
          { pageToken }
        );
        const page = response.ads ?? [];
        setAds((previous) => (pageToken ? [...previous, ...page] : page));
        setNextPageToken(response.next_page_token?.value || null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load ads.');
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, campaignId, adGroupId]
  );

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  return (
    <div className="space-y-6 animate-fade-in">
      <AdGroupSummary adGroup={adGroup} />

      {error ? (
        <ErrorState
          title="Could not load ads"
          message={error}
          onRetry={() => void loadAds()}
        />
      ) : isLoading && ads.length === 0 ? (
        <div className="h-40 skeleton-shimmer rounded" />
      ) : ads.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">No ads</h3>
          <p className="mt-2 text-gray-600">
            This ad group has no ads yet. Create one with{' '}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
              POST /v1/ads/{'{account_id}'}/campaigns/{'{campaign_id}'}
              /ad-groups/{'{ad_group_id}'}/ads
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ad group
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ads.map((ad) => (
                <tr key={ad.ad_id} className="table-row">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {ad.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                    {ad.ad_id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                    {ad.ad_group_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <span>
              {ads.length} ad{ads.length === 1 ? '' : 's'} loaded
            </span>
            {nextPageToken && (
              <button
                onClick={() => void loadAds(nextPageToken)}
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
