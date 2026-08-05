'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ErrorState from '@/components/ui/ErrorState';
import { uberAds } from '@/lib/api';
import type { Product, Store } from '@/types/api';

type Tab = 'stores' | 'products';

const TABS: Array<{ id: Tab; label: string; endpoint: string }> = [
  { id: 'stores', label: 'Stores', endpoint: 'GET /v1/ads/{ad_account_id}/stores' },
  { id: 'products', label: 'Products', endpoint: 'GET /v1/ads/{account_id}/products' },
];

export default function CatalogPage() {
  const { selectedAdAccount } = useAuth();
  const [tab, setTab] = useState<Tab>('stores');

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accountId = selectedAdAccount?.ad_account_id;

  const load = useCallback(
    async (pageToken?: string) => {
      if (!accountId) return;

      setIsLoading(true);
      setError(null);

      try {
        if (tab === 'stores') {
          const response = await uberAds.getStores(accountId, { pageToken });
          const page = response.stores ?? [];
          setStores((previous) => (pageToken ? [...previous, ...page] : page));
          setNextPageToken(response.next_page_token?.value || null);
        } else {
          const response = await uberAds.getProducts(accountId, { pageToken });
          const page = response.products ?? [];
          setProducts((previous) =>
            pageToken ? [...previous, ...page] : page
          );
          setNextPageToken(response.next_page_token?.value || null);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Request failed.');
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, tab]
  );

  useEffect(() => {
    setNextPageToken(null);
    void load();
  }, [load]);

  const activeTab = TABS.find((item) => item.id === tab)!;
  const rowCount = tab === 'stores' ? stores.length : products.length;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">
            {activeTab.endpoint}
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {error ? (
          <ErrorState
            title={`Could not load ${tab}`}
            message={error}
            onRetry={() => void load()}
          />
        ) : isLoading && rowCount === 0 ? (
          <div className="h-64 skeleton-shimmer rounded" />
        ) : rowCount === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900">
              No {tab} found
            </h3>
            <p className="mt-2 text-gray-600">
              This ad account has no {tab} available.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              {tab === 'stores' ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Store', 'Store ID', 'Currency', 'Address'].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stores.map((store) => (
                      <tr key={store.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {store.name}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {store.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {store.currency_code ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {[
                            store.address?.address_line1,
                            store.address?.city,
                            store.address?.region,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Product', 'GTIN', 'Brand', 'Brand owner', 'Size'].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/*
                      A product has no unique id — the same GTIN can repeat
                      across variants — so the index is folded into the key.
                      Safe here because pages are only ever appended, never
                      reordered or filtered.
                    */}
                    {products.map((product, index) => (
                      <tr
                        key={`${product.gtin ?? 'product'}-${index}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {product.product_name}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {product.gtin}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {product.brand_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {product.brand_owner_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {product.size ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
              <span>
                {rowCount} {tab} loaded
              </span>
              {nextPageToken && (
                <button
                  onClick={() => void load(nextPageToken)}
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
    </DashboardLayout>
  );
}
