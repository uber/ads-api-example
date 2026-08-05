import { NextRequest, NextResponse } from 'next/server';
import { ConfigError, serverConfig } from '@/lib/uber/config';
import { refreshTokens } from '@/lib/uber/oauth';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistTokens,
} from '@/lib/uber/session';

/**
 * Transparent proxy for the Uber Ads API.
 *
 * `/api/uber/<path>` forwards to `https://api.uber.com/<path>`, attaching the
 * access token from the httpOnly session cookie. Because a single handler
 * covers every endpoint, adding a new one requires no server changes.
 *
 * It exists for two reasons:
 *  1. `api.uber.com` sends no CORS headers, so the browser cannot call it.
 *  2. The access token stays server-side and never reaches client JavaScript.
 */

/**
 * Paths the proxy is willing to forward. Without this, the proxy would happily
 * attach the user's token to any Uber API the token happens to be valid for.
 */
const ALLOWED_PATH = /^v1\/ads(\/|$)/;

/** No session at all — the user has not signed in, or signed out. */
const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authenticated. Sign in with Uber to continue.' },
    { status: 401 }
  );

/** The refresh token itself is dead, so the session cannot be recovered. */
const sessionExpired = () =>
  NextResponse.json(
    { error: 'Your Uber session expired. Sign in again to continue.' },
    { status: 401 }
  );

/**
 * Returns Uber's response verbatim.
 *
 * Forwarding the original status and body matters most for 401 and 403: those
 * usually mean the granted token lacks the scope an endpoint requires, and
 * Uber's message says which. Replacing it with a generic error hides the only
 * useful diagnostic.
 */
async function passthrough(response: Response): Promise<NextResponse> {
  const body = await response.text();
  return new NextResponse(body || null, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Exchanges a refresh token for a new access token.
 * Returns `null` when the refresh token is rejected, which is the only signal
 * that genuinely invalidates the session.
 */
async function renewSession(refreshToken: string) {
  try {
    const tokens = await refreshTokens(refreshToken);
    await persistTokens(tokens);
    return tokens;
  } catch {
    await clearSession();
    return null;
  }
}

/**
 * `body` is passed in rather than read from `request` because a request body
 * is a one-shot stream. The 401 path calls this twice, and re-reading would
 * throw `Body has already been read` — masking Uber's answer as a 502.
 */
async function forward(
  request: NextRequest,
  path: string[],
  accessToken: string,
  body: string | undefined
): Promise<Response> {
  const target = new URL(
    `${serverConfig.apiBaseUrl}/${path.join('/')}${request.nextUrl.search}`
  );

  return fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body,
    cache: 'no-store',
  });
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;

  if (!ALLOWED_PATH.test(path.join('/'))) {
    return NextResponse.json(
      { error: 'This proxy only forwards requests to /v1/ads/*.' },
      { status: 403 }
    );
  }

  let accessToken = await getAccessToken();

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;

  try {
    // The access-token cookie expires with the token, so an absent token means
    // we should try the refresh token before giving up.
    if (!accessToken) {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return unauthorized();

      const tokens = await renewSession(refreshToken);
      if (!tokens) return sessionExpired();
      accessToken = tokens.access_token;
    }

    let response = await forward(request, path, accessToken, body);

    // A 401 here is ambiguous: the token may have expired, or it may simply
    // lack the scope this endpoint requires. Only the first case is worth
    // retrying, and neither justifies discarding a working session — so we
    // attempt one refresh and otherwise let Uber's own answer through.
    if (response.status === 401) {
      const refreshToken = await getRefreshToken();

      if (refreshToken) {
        const tokens = await renewSession(refreshToken);
        if (!tokens) return sessionExpired();
        response = await forward(request, path, tokens.access_token, body);
      }
    }

    return passthrough(response);
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        error: 'Could not reach the Uber Ads API.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
