'use client';

import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { humanizeEnum } from '@/lib/format';

function DetailRow({
  label,
  children,
  striped,
}: {
  label: string;
  children: React.ReactNode;
  striped: boolean;
}) {
  return (
    <div
      className={`px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${striped ? 'bg-gray-50' : 'bg-white'}`}
    >
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
        {children}
      </dd>
    </div>
  );
}

export default function AccountPage() {
  const { selectedAdAccount, adAccounts } = useAuth();

  if (!selectedAdAccount) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">
            No ad account selected
          </h3>
          <p className="mt-2 text-gray-600">
            Pick an account from the selector above to view its details.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const { billing } = selectedAdAccount;
  const address = billing?.address;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ad account</h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">
            GET /v1/ads/ad-accounts
          </p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">
              Account information
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {adAccounts.length} account
              {adAccounts.length === 1 ? '' : 's'} available to this OAuth
              token.
            </p>
          </div>
          <dl className="border-t border-gray-200">
            <DetailRow label="Account ID" striped>
              <span className="font-mono text-xs">
                {selectedAdAccount.ad_account_id}
              </span>
            </DetailRow>
            <DetailRow label="Name" striped={false}>
              {selectedAdAccount.name}
            </DetailRow>
            <DetailRow label="Account type" striped>
              {humanizeEnum(selectedAdAccount.account_type)}
            </DetailRow>
            <DetailRow label="Country" striped={false}>
              {selectedAdAccount.country_code ?? '—'}
            </DetailRow>
            <DetailRow label="Currency" striped>
              {selectedAdAccount.currency_code ?? '—'}
            </DetailRow>
          </dl>
        </div>

        {billing && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900">Billing</h2>
            </div>
            <dl className="border-t border-gray-200">
              <DetailRow label="Billing type" striped>
                {humanizeEnum(billing.type)}
              </DetailRow>
              {address && (
                <DetailRow label="Address" striped={false}>
                  <div className="space-y-1">
                    {address.address_line1 && <div>{address.address_line1}</div>}
                    {address.address_line2 && <div>{address.address_line2}</div>}
                    <div>
                      {[address.city, address.state, address.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                    {address.country_code && <div>{address.country_code}</div>}
                  </div>
                </DetailRow>
              )}
            </dl>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
