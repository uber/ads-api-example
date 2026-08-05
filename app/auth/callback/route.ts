import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/uber/oauth';
import { consumeOAuthState, persistTokens } from '@/lib/uber/session';

/**
 * OAuth redirect target. This path must exactly match the redirect URI
 * registered on your Uber app and the `UBER_REDIRECT_URI` env var.
 *
 * Handling the callback as a route handler (rather than a page) keeps the
 * authorization code and the resulting tokens entirely on the server.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const failure = (reason: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, request.url)
    );

  const error = params.get('error');
  if (error) {
    return failure(params.get('error_description') || error);
  }

  const code = params.get('code');
  if (!code) {
    return failure('Uber did not return an authorization code.');
  }

  // Reject the callback unless it carries the state we issued, which prevents
  // an attacker from injecting their own authorization code.
  const expectedState = await consumeOAuthState();
  if (!expectedState || params.get('state') !== expectedState) {
    return failure('OAuth state mismatch. Please start the login flow again.');
  }

  try {
    await persistTokens(await exchangeCodeForTokens(code));
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Token exchange failed.';
    return failure(message);
  }

  return NextResponse.redirect(new URL('/dashboard/campaigns', request.url));
}
