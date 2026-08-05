/**
 * Status helpers.
 *
 * The API returns fully-qualified enum values such as
 * `CAMPAIGN_EFFECTIVE_STATUS_ACTIVE` or `AD_GROUP_CONFIGURED_STATUS_PAUSED`.
 * Comparing against a bare `'active'` will silently never match, so always
 * normalize first.
 */

/** Strips the `<ENTITY>_<KIND>_STATUS_` prefix and lowercases the remainder. */
export function normalizeStatus(status: string | undefined): string {
  if (!status) return 'unknown';
  return status.toLowerCase().replace(/^.*?status_/, '').trim();
}

export function isActive(status: string | undefined): boolean {
  return normalizeStatus(status) === 'active';
}

const BADGE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  eligible: 'bg-green-100 text-green-800',
  paused: 'bg-orange-100 text-orange-800',
  suspended: 'bg-orange-100 text-orange-800',
  ended: 'bg-blue-100 text-blue-800',
  completed: 'bg-blue-100 text-blue-800',
  expired: 'bg-blue-100 text-blue-800',
  draft: 'bg-purple-100 text-purple-800',
  scheduled: 'bg-purple-100 text-purple-800',
  pending: 'bg-purple-100 text-purple-800',
  under_review: 'bg-indigo-100 text-indigo-800',
  pending_review: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  invalid: 'bg-red-100 text-red-800',
};

const DOT_COLORS: Record<string, string> = {
  green: 'bg-green-400',
  orange: 'bg-orange-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  indigo: 'bg-indigo-400',
  red: 'bg-red-400',
};

export function getStatusBadgeColor(status: string | undefined): string {
  return BADGE_COLORS[normalizeStatus(status)] ?? 'bg-gray-100 text-gray-800';
}

export function getStatusDotColor(status: string | undefined): string {
  const badge = getStatusBadgeColor(status);
  const hue = Object.keys(DOT_COLORS).find((color) => badge.includes(color));
  return hue ? DOT_COLORS[hue] : 'bg-gray-400';
}

/** Turns `CAMPAIGN_EFFECTIVE_STATUS_UNDER_REVIEW` into `Under Review`. */
export function getStatusLabel(status: string | undefined): string {
  return normalizeStatus(status)
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
