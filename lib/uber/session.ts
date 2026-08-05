import { cookies } from 'next/headers';

/**
 * Token storage.
 *
 * Tokens live in httpOnly cookies so browser JavaScript can never read them.
 * The browser talks only to this app's own routes; the access token is
 * attached server-side by the proxy in `app/api/uber/[...path]/route.ts`.
 */

const ACCESS_TOKEN_COOKIE = 'uber_access_token';
const REFRESH_TOKEN_COOKIE = 'uber_refresh_token';
const OAUTH_STATE_COOKIE = 'uber_oauth_state';
const GRANTED_SCOPES_COOKIE = 'uber_granted_scopes';

export interface UberTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
}

export async function persistTokens(tokens: UberTokenResponse): Promise<void> {
  const store = await cookies();

  // Expire the cookie slightly before the token itself so a stale token is
  // never sent. Uber returns 86400s; fall back to that if absent.
  const accessMaxAge = Math.max((tokens.expires_in ?? 86_400) - 60, 60);

  store.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    ...baseCookieOptions,
    maxAge: accessMaxAge,
  });

  // Uber refresh tokens do not expire, but scope the cookie to 30 days so an
  // abandoned session does not linger indefinitely.
  if (tokens.refresh_token) {
    store.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
      ...baseCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Uber may grant fewer scopes than were requested, in which case the
  // affected endpoints return 401 even though the token is perfectly valid.
  // Recording what was actually granted lets the UI explain that up front.
  if (tokens.scope) {
    store.set(GRANTED_SCOPES_COOKIE, tokens.scope, {
      ...baseCookieOptions,
      maxAge: accessMaxAge,
    });
  }
}

export async function getGrantedScopes(): Promise<string[]> {
  const raw = (await cookies()).get(GRANTED_SCOPES_COOKIE)?.value;
  return raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  store.delete(OAUTH_STATE_COOKIE);
  store.delete(GRANTED_SCOPES_COOKIE);
}

export async function setOAuthState(state: string): Promise<void> {
  (await cookies()).set(OAUTH_STATE_COOKIE, state, {
    ...baseCookieOptions,
    maxAge: 600, // Authorization codes expire after 10 minutes.
  });
}

/** Reads and immediately consumes the stored state, so it cannot be replayed. */
export async function consumeOAuthState(): Promise<string | undefined> {
  const store = await cookies();
  const state = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  return state;
}
