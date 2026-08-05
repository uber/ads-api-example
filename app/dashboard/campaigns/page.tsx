'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { assertBatchSuccess, uberAds } from '@/lib/api';
import type { AdGroup, Campaign } from '@/types/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdGroupsView from '@/components/campaigns/AdGroupsView';
import AdUnitsView from '@/components/campaigns/AdUnitsView';
import Breadcrumb, { BreadcrumbItem } from '@/components/ui/Breadcrumb';
import ErrorState from '@/components/ui/ErrorState';
import {
  getStatusBadgeColor,
  getStatusDotColor,
  getStatusLabel,
  isActive,
  normalizeStatus,
} from '@/lib/status-utils';
import { formatBudget, formatDate } from '@/lib/format';

type SortField = 'name' | 'status' | 'budget' | 'ad_groups' | 'created_at';

function CampaignsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedAdAccount } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedAdGroup, setSelectedAdGroup] = useState<AdGroup | null>(null);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(
    null
  );
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAscending, setSortAscending] = useState(false);

  const accountId = selectedAdAccount?.ad_account_id;
  const campaignId = searchParams.get('campaignId');
  const adGroupId = searchParams.get('adGroupId');

  const loadCampaigns = useCallback(
    async (pageToken?: string) => {
      if (!accountId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await uberAds.getCampaigns(accountId, { pageToken });
        const page = response.campaigns ?? [];
        setCampaigns((previous) => (pageToken ? [...previous, ...page] : page));
        setNextPageToken(response.next_page_token?.value || null);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to load campaigns.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [accountId]
  );

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const selectedCampaign = useMemo(
    () =>
      campaignId
        ? (campaigns.find((c) => c.campaign_id === campaignId) ?? null)
        : null,
    [campaigns, campaignId]
  );

  // The list endpoint only returns ad group summaries, so drill-down into a
  // specific ad group needs a second request for the full object.
  useEffect(() => {
    if (!accountId || !campaignId || !adGroupId) {
      setSelectedAdGroup(null);
      return;
    }

    let cancelled = false;

    uberAds
      .getAdGroups(accountId, campaignId)
      .then((response) => {
        if (cancelled) return;
        setSelectedAdGroup(
          response.ad_groups?.find((g) => g.ad_group_id === adGroupId) ?? null
        );
      })
      .catch(() => {
        if (!cancelled) setSelectedAdGroup(null);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, campaignId, adGroupId]);

  /**
   * Demonstrates `PATCH /v1/ads/{account_id}/campaigns`, which takes a batch
   * of campaigns and reports the outcome of each one individually.
   */
  const toggleCampaignStatus = async (campaign: Campaign) => {
    if (!accountId || !campaign.campaign_id) return;

    const nextStatus = isActive(campaign.configured_status)
      ? 'CAMPAIGN_CONFIGURED_STATUS_PAUSED'
      : 'CAMPAIGN_CONFIGURED_STATUS_ACTIVE';

    setPendingCampaignId(campaign.campaign_id);
    setError(null);

    try {
      const response = await uberAds.updateCampaigns(accountId, {
        campaigns: [
          {
            campaign_id: campaign.campaign_id,
            configured_status: nextStatus,
          },
        ],
      });
      assertBatchSuccess(response);
      await loadCampaigns();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to update campaign.'
      );
    } finally {
      setPendingCampaignId(null);
    }
  };

  const sortedCampaigns = useMemo(() => {
    const direction = sortAscending ? 1 : -1;

    const key = (campaign: Campaign): string | number => {
      switch (sortField) {
        case 'status':
          return normalizeStatus(campaign.effective_status);
        case 'budget':
          return Number(campaign.budget?.total?.amount_e5 ?? 0);
        case 'ad_groups':
          return campaign.ad_groups?.length ?? 0;
        case 'created_at':
          return new Date(campaign.created_at ?? 0).getTime();
        default:
          return campaign.name?.toLowerCase() ?? '';
      }
    };

    return [...campaigns].sort((a, b) => {
      const left = key(a);
      const right = key(b);
      if (left < right) return -direction;
      if (left > right) return direction;
      return 0;
    });
  }, [campaigns, sortField, sortAscending]);

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
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
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

  const breadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      {
        id: 'campaigns',
        name: 'Campaigns',
        onClick: () => router.push('/dashboard/campaigns'),
      },
    ];

    if (selectedCampaign) {
      items.push({
        id: 'campaign',
        name: selectedCampaign.name ?? 'Campaign',
        onClick: () =>
          router.push(
            `/dashboard/campaigns?campaignId=${selectedCampaign.campaign_id}`
          ),
      });
    }

    if (selectedAdGroup) {
      items.push({
        id: 'adGroup',
        name: selectedAdGroup.name ?? 'Ad group',
      });
    }

    return items;
  };

  const view =
    selectedCampaign && selectedAdGroup
      ? 'adUnits'
      : selectedCampaign
        ? 'adGroups'
        : 'campaigns';

  const heading = {
    campaigns: {
      title: 'Campaigns',
      subtitle: selectedAdAccount
        ? `GET /v1/ads/${selectedAdAccount.ad_account_id}/campaigns`
        : 'Select an ad account to begin.',
    },
    adGroups: {
      title: `Ad groups — ${selectedCampaign?.name ?? ''}`,
      subtitle: `GET /v1/ads/{account_id}/campaigns/${selectedCampaign?.campaign_id}/ad-groups`,
    },
    adUnits: {
      title: `Ads — ${selectedAdGroup?.name ?? ''}`,
      subtitle: `GET /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/${selectedAdGroup?.ad_group_id}/ads`,
    },
  }[view];

  const renderCampaignsTable = () => {
    if (campaigns.length === 0) {
      return (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">No campaigns</h3>
          <p className="mt-2 text-gray-600">
            This ad account has no campaigns yet.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
          >
            Create one
          </Link>
        </div>
      );
    }

    return (
      <div className="bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                {sortableHeader('name', 'Campaign')}
                {sortableHeader('status', 'Status')}
                {sortableHeader('budget', 'Budget')}
                {sortableHeader('ad_groups', 'Ad groups')}
                {sortableHeader('created_at', 'Created')}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCampaigns.map((campaign) => (
                <tr key={campaign.campaign_id} className="table-row">
                  <td className="px-6 py-4">
                    <button
                      onClick={() =>
                        router.push(
                          `/dashboard/campaigns?campaignId=${campaign.campaign_id}`
                        )
                      }
                      className="text-sm font-medium text-gray-900 hover:text-black text-left"
                    >
                      {campaign.name}
                    </button>
                    {campaign.ad_groups && campaign.ad_groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {campaign.ad_groups.slice(0, 2).map((group) => (
                          <span
                            key={group.ad_group_id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                            title={getStatusLabel(group.effective_status)}
                          >
                            <span className="truncate max-w-24">
                              {group.name}
                            </span>
                            <span
                              className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${getStatusDotColor(group.effective_status)}`}
                            />
                          </span>
                        ))}
                        {campaign.ad_groups.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{campaign.ad_groups.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(campaign.effective_status)}`}
                    >
                      {getStatusLabel(campaign.effective_status)}
                    </span>
                    {campaign.configured_status !==
                      campaign.effective_status && (
                      <div className="text-xs text-gray-500 mt-1">
                        Configured:{' '}
                        {getStatusLabel(campaign.configured_status)}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatBudget(campaign.budget)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.ad_groups?.length ?? 0}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(campaign.created_at)}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-32">
                      {campaign.created_by_email}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => void toggleCampaignStatus(campaign)}
                      disabled={pendingCampaignId === campaign.campaign_id}
                      className="text-sm font-medium text-primary-600 hover:text-primary-900 disabled:opacity-50"
                    >
                      {pendingCampaignId === campaign.campaign_id
                        ? 'Saving…'
                        : isActive(campaign.configured_status)
                          ? 'Pause'
                          : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
          <span>
            {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
            {' · '}
            {campaigns.filter((c) => isActive(c.effective_status)).length}{' '}
            active
          </span>
          {nextPageToken && (
            <button
              onClick={() => void loadCampaigns(nextPageToken)}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && campaigns.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="h-8 w-48 skeleton-shimmer rounded" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 skeleton-shimmer rounded" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {view !== 'campaigns' && <Breadcrumb items={breadcrumbs()} />}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{heading.title}</h1>
            <p className="mt-1 text-sm text-gray-500 font-mono">
              {heading.subtitle}
            </p>
          </div>
          {view === 'campaigns' && (
            <Link
              href="/dashboard/campaigns/new"
              className="shrink-0 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
            >
              New campaign
            </Link>
          )}
        </div>

        {error && (
          <ErrorState
            title="Request failed"
            message={error}
            onRetry={() => void loadCampaigns()}
          />
        )}

        {view === 'adUnits' && selectedAdGroup && selectedCampaign && accountId ? (
          <AdUnitsView
            adGroup={selectedAdGroup}
            campaignId={selectedCampaign.campaign_id!}
            accountId={accountId}
          />
        ) : view === 'adGroups' && selectedCampaign && accountId ? (
          <AdGroupsView
            campaign={selectedCampaign}
            accountId={accountId}
            onAdGroupClick={(adGroup) =>
              router.push(
                `/dashboard/campaigns?campaignId=${selectedCampaign.campaign_id}&adGroupId=${adGroup.ad_group_id}`
              )
            }
          />
        ) : (
          renderCampaignsTable()
        )}
      </div>
    </DashboardLayout>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="h-64 skeleton-shimmer rounded" />
        </DashboardLayout>
      }
    >
      <CampaignsPageContent />
    </Suspense>
  );
}
