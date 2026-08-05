'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import AdAccountSelector from './AdAccountSelector';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with ad account selector */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">
                Ad Account:
              </h1>
              <AdAccountSelector />
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Additional header content can go here */}
            </div>
          </div>
        </div>
        
        {/* Page content */}
        <main className="flex-1 overflow-auto bg-white">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
