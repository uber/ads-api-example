import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/uber/oauth';
import { setOAuthState } from '@/lib/uber/session';
import { ConfigError } from '@/lib/uber/config';

/** Starts the OAuth flow by redirecting the user to Uber's consent screen. */
export async function GET() {
  try {
    const state = crypto.randomUUID();
    await setOAuthState(state);
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
