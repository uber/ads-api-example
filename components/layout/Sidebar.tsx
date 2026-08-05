'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  BuildingStorefrontIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import {
  ChartBarIcon as ChartBarIconSolid,
  DocumentChartBarIcon as DocumentChartBarIconSolid,
  BuildingStorefrontIcon as BuildingStorefrontIconSolid,
  UserIcon as UserIconSolid,
} from '@heroicons/react/24/solid';

const navigation = [
  {
    name: 'Campaigns',
    href: '/dashboard/campaigns',
    icon: ChartBarIcon,
    iconActive: ChartBarIconSolid,
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: DocumentChartBarIcon,
    iconActive: DocumentChartBarIconSolid,
  },
  {
    name: 'Catalog',
    href: '/dashboard/catalog',
    icon: BuildingStorefrontIcon,
    iconActive: BuildingStorefrontIconSolid,
  },
  {
    name: 'Account',
    href: '/dashboard/account',
    icon: UserIcon,
    iconActive: UserIconSolid,
  },
];

const bottomNavigation = [
  {
    name: 'Help',
    href: '/dashboard/help',
    icon: QuestionMarkCircleIcon,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 animate-fade-in">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded bg-black flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
            <span className="text-sm font-bold text-white">AD</span>
          </div>
          <span className="ml-3 text-lg font-semibold text-gray-900">
            Uber Ads API
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {/* Main navigation */}
          <li>
            <ul role="list" className="-mx-2 space-y-1 px-6">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = isActive && item.iconActive ? item.iconActive : item.icon;
                
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`
                        sidebar-item
                        ${
                          isActive
                            ? 'sidebar-item-active'
                            : 'sidebar-item-inactive'
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 shrink-0 mr-3 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>

          {/* Bottom navigation */}
          <li className="mt-auto">
            <ul role="list" className="-mx-2 space-y-1 px-6 pb-6">
              {bottomNavigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="sidebar-item sidebar-item-inactive"
                  >
                    <item.icon className="h-5 w-5 shrink-0 mr-3" aria-hidden="true" />
                    {item.name}
                  </Link>
                </li>
              ))}
              
              {/* Logout button */}
              <li>
                <button
                  onClick={() => void logout()}
                  className="sidebar-item sidebar-item-inactive w-full text-left"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0 mr-3" aria-hidden="true" />
                  Log out
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
