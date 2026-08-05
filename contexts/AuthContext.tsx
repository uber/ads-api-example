'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { AdAccount } from '@/types/api';
import { getSession, logout as endSession } from '@/lib/auth';
import { uberAds, UberApiError } from '@/lib/api';

const SELECTED_ACCOUNT_KEY = 'uber_ads_selected_account_id';

interface AuthContextValue {
  /** `null` while the session check is still in flight. */
  isAuthenticated: boolean | null;
  adAccounts: AdAccount[];
  selectedAdAccount: AdAccount | null;
  isLoading: boolean;
  error: string | null;
  /** Scopes Uber granted. Empty if the token response omitted them. */
  grantedScopes: string[];
  /**
   * Whether a scope was granted. Returns `true` when the granted list is
   * unknown, so features are never hidden on incomplete information.
   */
  hasScope: (scope: string) => boolean;
  logout: () => Promise<void>;
  selectAdAccount: (account: AdAccount) => void;
  refreshAdAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<AdAccount | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);

  const loadAdAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { ad_accounts } = await uberAds.getAdAccounts();
      const accounts = ad_accounts ?? [];
      setAdAccounts(accounts);

      // Restore the previously chosen account, otherwise fall back to the
      // first one so the dashboard always has something to render.
      const storedId =
        typeof window === 'undefined'
          ? null
          : localStorage.getItem(SELECTED_ACCOUNT_KEY);
      setSelectedAdAccount(
        accounts.find((account) => account.ad_account_id === storedId) ??
          accounts[0] ??
          null
      );
    } catch (cause) {
      if (cause instanceof UberApiError && cause.isUnauthenticated) {
        setIsAuthenticated(false);
      }
      setError(
        cause instanceof Error ? cause.message : 'Failed to load ad accounts.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getSession().then(async (session) => {
      if (cancelled) return;
      setIsAuthenticated(session.authenticated);
      setGrantedScopes(session.scopes);
      if (session.authenticated) {
        await loadAdAccounts();
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadAdAccounts]);

  const logout = useCallback(async () => {
    localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    setAdAccounts([]);
    setSelectedAdAccount(null);
    setGrantedScopes([]);
    setIsAuthenticated(false);
    await endSession();
  }, []);

  const hasScope = useCallback(
    (scope: string) =>
      grantedScopes.length === 0 || grantedScopes.includes(scope),
    [grantedScopes]
  );

  const selectAdAccount = useCallback((account: AdAccount) => {
    setSelectedAdAccount(account);
    if (account.ad_account_id) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, account.ad_account_id);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        adAccounts,
        selectedAdAccount,
        isLoading,
        error,
        grantedScopes,
        hasScope,
        logout,
        selectAdAccount,
        refreshAdAccounts: loadAdAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
