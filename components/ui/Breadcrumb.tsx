'use client';

import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

export interface BreadcrumbItem {
  id: string;
  name: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex animate-slide-up" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-4">
        <li>
          <div>
            <button
              onClick={items[0]?.onClick}
              className="text-gray-400 hover:text-gray-600 transition-all duration-200 transform hover:scale-110 breadcrumb-item"
            >
              <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </button>
          </div>
        </li>
        {items.map((item, index) => (
          <li key={item.id}>
            <div className="flex items-center">
              <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-300 transition-transform duration-200" aria-hidden="true" />
              <button
                onClick={item.onClick}
                className={`ml-4 text-sm font-medium transition-all duration-200 breadcrumb-item ${
                  index === items.length - 1
                    ? 'text-gray-900 cursor-default'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                disabled={index === items.length - 1}
              >
                {item.name}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
