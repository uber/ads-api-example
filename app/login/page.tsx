'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { startLogin } from '@/lib/auth';

function LoginScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const error = useSearchParams().get('error');

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard/campaigns');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        <div className="animate-slide-up">
          <div className="flex justify-center">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">AD</span>
              </div>
              <span className="ml-3 text-2xl font-bold text-gray-900">
                Uber Ads API Example
              </span>
            </div>
          </div>

          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connect your ad account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with Uber to explore the Ads API against your own data.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-medium">Sign-in failed</p>
            <p className="mt-1 break-words">{error}</p>
          </div>
        )}

        <div className="mt-8 animate-slide-up">
          <button
            onClick={startLogin}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
          >
            Sign in with Uber
          </button>

          <p className="mt-4 text-center text-xs text-gray-500">
            You will be redirected to Uber to authorize this application. It
            requests read access to your ad accounts, campaigns, products, and
            reporting, plus write access to campaigns.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
