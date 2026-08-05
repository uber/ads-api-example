'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isAuthenticated === null) return;
    router.replace(isAuthenticated ? '/dashboard/campaigns' : '/login');
  }, [isAuthenticated, isLoading, router]);

  // Show loading spinner while checking authentication
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
        <h2 className="mt-6 text-xl font-semibold text-gray-900">Loading...</h2>
        <p className="mt-2 text-gray-600">Please wait while we redirect you.</p>
      </div>
    </div>
  );
}
