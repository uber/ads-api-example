import { OAUTH_ENDPOINTS, requireServerConfig } from './config';
import type { UberTokenResponse } from './session';

/**
 * Uber OAuth 2.0 authorization code flow.
 *
 * Uber does not support the client credentials grant, so a user must approve
 * access in the browser before the API can be called on their behalf.
 * @see https://developer.uber.com/docs/ads/get-started/authentication
 */

export class OAuthError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'OAuthError';
    this.status = status;
    this.details = details;
  }
}

export function buildAuthorizeUrl(state: string): string {
  const config = requireServerConfig();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
  });

  return `${OAUTH_ENDPOINTS.authorize(config.authBaseUrl)}?${params}`;
}

async function requestToken(
  params: Record<string, string>
): Promise<UberTokenResponse> {
  const config = requireServerConfig();

  const response = await fetch(OAUTH_ENDPOINTS.token(config.authBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    let details: unknown = body;
    try {
      details = JSON.parse(body);
    } catch {
      // Uber occasionally returns a plain-text error; keep the raw body.
    }
    throw new OAuthError(
      `Uber token request failed (${response.status})`,
      response.status,
      details
    );
  }

  return JSON.parse(body) as UberTokenResponse;
}

export function exchangeCodeForTokens(code: string): Promise<UberTokenResponse> {
  const config = requireServerConfig();
  return requestToken({
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code,
  });
}

export function refreshTokens(refreshToken: string): Promise<UberTokenResponse> {
  return requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}
