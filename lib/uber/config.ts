import { UBER_ADS_SCOPES } from './scopes';

/**
 * Server-only configuration for the Uber Ads API.
 *
 * Every value is sourced from environment variables so that nothing sensitive
 * is ever committed. See `.env.example` for the full list. Import this module
 * only from route handlers — never from a client component.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const serverConfig = {
  clientId: process.env.UBER_CLIENT_ID ?? '',
  clientSecret: process.env.UBER_CLIENT_SECRET ?? '',
  redirectUri: process.env.UBER_REDIRECT_URI || `${appUrl}/auth/callback`,
  scope: process.env.UBER_SCOPES || UBER_ADS_SCOPES.join(' '),
  authBaseUrl: process.env.UBER_AUTH_BASE_URL || 'https://auth.uber.com',
  apiBaseUrl: process.env.UBER_API_BASE_URL || 'https://api.uber.com',
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Returns the server config, failing loudly when credentials are absent.
 * A missing `.env.local` is by far the most common setup mistake, so the
 * message points directly at the fix.
 */
export function requireServerConfig() {
  const missing = (['clientId', 'clientSecret'] as const).filter(
    (key) => !serverConfig[key]
  );

  if (missing.length > 0) {
    const envNames = missing.map((key) =>
      key === 'clientId' ? 'UBER_CLIENT_ID' : 'UBER_CLIENT_SECRET'
    );
    throw new ConfigError(
      `Missing required environment variable(s): ${envNames.join(', ')}. ` +
        'Copy .env.example to .env.local and fill in your credentials from https://developer.uber.com/dashboard.'
    );
  }

  return serverConfig as typeof serverConfig & {
    clientId: string;
    clientSecret: string;
  };
}

export const OAUTH_ENDPOINTS = {
  authorize: (baseUrl: string) => `${baseUrl}/oauth/v2/authorize`,
  token: (baseUrl: string) => `${baseUrl}/oauth/v2/token`,
};
