'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { UBER_ADS_SCOPES } from '@/lib/uber/scopes';

const ENDPOINTS: Array<{
  group: string;
  items: Array<{ method: string; path: string; scope: string }>;
}> = [
  {
    group: 'Ad accounts',
    items: [
      {
        method: 'GET',
        path: '/v1/ads/ad-accounts',
        scope: 'ads.ad-accounts.read',
      },
      {
        method: 'GET',
        path: '/v1/ads/{ad_account_id}/stores',
        scope: 'ads.ad-accounts.read',
      },
    ],
  },
  {
    group: 'Campaigns',
    items: [
      {
        method: 'GET',
        path: '/v1/ads/{account_id}/campaigns',
        scope: 'ads.campaigns.read',
      },
      {
        method: 'POST',
        path: '/v1/ads/{account_id}/campaigns',
        scope: 'ads.campaigns.write',
      },
      {
        method: 'PATCH',
        path: '/v1/ads/{account_id}/campaigns',
        scope: 'ads.campaigns.write',
      },
    ],
  },
  {
    group: 'Ad groups',
    items: [
      {
        method: 'GET',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups',
        scope: 'ads.campaigns.read',
      },
      {
        method: 'POST',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups',
        scope: 'ads.campaigns.write',
      },
      {
        method: 'PATCH',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups',
        scope: 'ads.campaigns.write',
      },
    ],
  },
  {
    group: 'Ads',
    items: [
      {
        method: 'GET',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads',
        scope: 'ads.campaigns.read',
      },
      {
        method: 'POST',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads',
        scope: 'ads.campaigns.write',
      },
      {
        method: 'PATCH',
        path: '/v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads',
        scope: 'ads.campaigns.write',
      },
    ],
  },
  {
    group: 'Products',
    items: [
      {
        method: 'GET',
        path: '/v1/ads/{account_id}/products',
        scope: 'ads.products.read',
      },
    ],
  },
  {
    group: 'Reporting',
    items: [
      {
        method: 'POST',
        path: '/v1/ads/{account_id}/reporting/sync',
        scope: 'ads.reporting',
      },
      {
        method: 'POST',
        path: '/v1/ads/{account_id}/reporting/report',
        scope: 'ads.reporting',
      },
      {
        method: 'GET',
        path: '/v1/ads/{account_id}/reporting/{report_id}',
        scope: 'ads.reporting',
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PATCH: 'bg-amber-100 text-amber-800',
};

const GOTCHAS = [
  'Pagination cursors are objects: read `next_page_token.value` and send it back as the `page_token` query parameter. `page_limit` caps out at 2000.',
  'Money is `amount_e5`, a string holding the value multiplied by 100,000. Divide by 100,000 before displaying.',
  'Statuses are fully qualified, e.g. `CAMPAIGN_EFFECTIVE_STATUS_ACTIVE`. Comparing against a bare `active` never matches.',
  'Writes are batched and return per-item `success` or `failure` inside a 200 response, so a 200 does not mean every item succeeded.',
  'Uber does not support the client credentials grant. A user must approve the app through the browser.',
  'Report status polling is limited to one request every 10 seconds.',
];

const LINKS = [
  {
    label: 'Ads API introduction',
    href: 'https://developer.uber.com/docs/ads/introduction',
  },
  {
    label: 'Authentication guide',
    href: 'https://developer.uber.com/docs/ads/get-started/authentication',
  },
  {
    label: 'Reporting metrics',
    href: 'https://developer.uber.com/docs/ads/reporting-metrics/overview',
  },
  {
    label: 'OpenAPI specification',
    href: 'https://developer.uber.com/integration-resources/ads/openapi.json',
  },
  {
    label: 'Developer dashboard',
    href: 'https://developer.uber.com/dashboard',
  },
];

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API reference</h1>
          <p className="mt-1 text-gray-600">
            Every endpoint in the Uber Ads API, and the ones this example
            exercises.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white shadow rounded-lg divide-y divide-gray-200">
            {ENDPOINTS.map((group) => (
              <div key={group.group} className="px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  {group.group}
                </h2>
                <ul className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <li
                      key={`${item.method} ${item.path}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span
                        className={`inline-block w-16 text-center px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[item.method]}`}
                      >
                        {item.method}
                      </span>
                      <code className="text-xs text-gray-800 break-all">
                        {item.path}
                      </code>
                      <span className="text-xs text-gray-400 font-mono">
                        {item.scope}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900">
                Requested scopes
              </h2>
              <ul className="mt-3 space-y-1">
                {UBER_ADS_SCOPES.map((scope) => (
                  <li key={scope} className="text-xs font-mono text-gray-700">
                    {scope}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900">Links</h2>
              <ul className="mt-3 space-y-2">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-900 underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900">
            Things that trip people up
          </h2>
          <ul className="mt-3 space-y-3">
            {GOTCHAS.map((gotcha) => (
              <li key={gotcha} className="text-sm text-gray-700 leading-relaxed">
                {gotcha}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
