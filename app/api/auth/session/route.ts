import { NextResponse } from 'next/server';
import {
  getAccessToken,
  getGrantedScopes,
  getRefreshToken,
} from '@/lib/uber/session';

/**
 * Lets the browser discover whether a session exists, and which scopes it
 * carries, without ever exposing the token itself.
 */
export async function GET() {
  const [accessToken, refreshToken, scopes] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
    getGrantedScopes(),
  ]);

  return NextResponse.json({
    authenticated: Boolean(accessToken || refreshToken),
    /** Empty when Uber did not report a scope list on the token response. */
    scopes,
    /** Whether the session can outlive the current access token. */
    canRefresh: Boolean(refreshToken),
  });
}
