import type { Budget, CurrencyAmount } from '@/types/api';

/**
 * Formatting helpers for the shapes the Uber Ads API actually returns.
 */

/**
 * Money arrives as `amount_e5`: a *string* holding the value multiplied by
 * 100,000. Dividing the raw value would be off by five orders of magnitude,
 * and treating it as a number loses precision on large budgets.
 */
export function formatCurrency(amount?: CurrencyAmount): string {
  if (!amount?.amount_e5 || !amount.currency_code) return '—';

  const value = Number(amount.amount_e5) / 100_000;
  if (!Number.isFinite(value)) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: amount.currency_code,
  }).format(value);
}

/** Inverse of {@link formatCurrency}: takes `25`, not the string `"2500000"`. */
export function toCurrencyAmount(
  amount: number,
  currencyCode: string
): Required<CurrencyAmount> {
  return {
    amount_e5: Math.round(amount * 100_000).toString(),
    currency_code: currencyCode,
  };
}

const BUDGET_UNIT_LABELS: Record<string, string> = {
  BUDGET_UNIT_FIXED: 'lifetime',
  BUDGET_UNIT_DAILY: 'day',
  BUDGET_UNIT_WEEKLY: 'week',
};

export function formatBudget(budget?: Budget): string {
  if (!budget?.total) return '—';

  const amount = formatCurrency(budget.total);
  const unit = budget.unit ? BUDGET_UNIT_LABELS[budget.unit] : undefined;
  return unit ? `${amount} / ${unit}` : amount;
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

/** Turns an enum value such as `MATCH_TYPE_EXACT` into `Exact`. */
export function humanizeEnum(value?: string): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
