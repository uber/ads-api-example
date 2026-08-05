/**
 * Browser-side session helpers.
 *
 * Tokens are held in httpOnly cookies, so this module cannot read them. It
 * only asks the server whether a session exists and triggers login/logout.
 */

/** Full-page navigation to the server route that redirects to Uber. */
export function startLogin(): void {
  window.location.href = '/api/auth/login';
}

export interface Session {
  authenticated: boolean;
  /** Scopes Uber actually granted, which may be fewer than were requested. */
  scopes: string[];
  canRefresh: boolean;
}

const NO_SESSION: Session = {
  authenticated: false,
  scopes: [],
  canRefresh: false,
};

export async function getSession(): Promise<Session> {
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) return NO_SESSION;
    return (await response.json()) as Session;
  } catch {
    return NO_SESSION;
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}
