'use client';

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { useAuth } from '@/contexts/AuthContext';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AdAccountSelector() {
  const { adAccounts, selectedAdAccount, selectAdAccount, isLoading } = useAuth();

  if (isLoading || !adAccounts.length) {
    return (
      <div className="w-64 animate-fade-in">
        <div className="h-10 bg-gray-100 rounded-md skeleton-shimmer"></div>
      </div>
    );
  }

  return (
    <Listbox value={selectedAdAccount ?? undefined} onChange={selectAdAccount}>
      {({ open }) => (
        <div className="relative w-64 animate-scale-in">
          <Listbox.Label className="block text-sm font-medium leading-6 text-gray-900 sr-only">
            Select Ad Account
          </Listbox.Label>
          <div className="relative">
            <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-2.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-black sm:text-sm transition-all duration-200 transform hover:scale-105">
              <span className="block truncate">
                {selectedAdAccount ? selectedAdAccount.name : 'Select account...'}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {adAccounts.map((account) => (
                  <Listbox.Option
                    key={account.ad_account_id}
                    className={({ active }) =>
                      classNames(
                        active ? 'bg-black text-white' : 'text-gray-900',
                        'relative cursor-default select-none py-2 pl-3 pr-9 transition-colors duration-200'
                      )
                    }
                    value={account}
                  >
                    {({ selected, active }) => (
                      <>
                        <div className="flex flex-col">
                          <span
                            className={classNames(
                              selected ? 'font-semibold' : 'font-normal',
                              'block truncate'
                            )}
                          >
                            {account.name}
                          </span>
                          <span
                            className={classNames(
                              active ? 'text-gray-300' : 'text-gray-500',
                              'text-xs'
                            )}
                          >
                            {account.ad_account_id} • {account.country_code}
                          </span>
                        </div>

                        {selected ? (
                          <span
                            className={classNames(
                              active ? 'text-white' : 'text-black',
                              'absolute inset-y-0 right-0 flex items-center pr-4'
                            )}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )}
    </Listbox>
  );
}
