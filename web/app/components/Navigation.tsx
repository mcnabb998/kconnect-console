'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMonitoringSummary } from '../monitoring/MonitoringSummaryProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ReactElement } from 'react';

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactElement;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/cluster', label: 'Cluster', Icon: ClusterIcon },
  { href: '/monitoring', label: 'Monitoring', Icon: PulseIcon },
  { href: '/health', label: 'Health', Icon: HeartIcon },
  { href: '/connectors/templates', label: 'Create', Icon: PlusSquareIcon },
  { href: '/audit-logs', label: 'Audit Logs', Icon: DocumentTextIcon },
  { href: '/capabilities', label: 'Capabilities', Icon: SparklesIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export function Navigation() {
  const pathname = usePathname();
  const { hasFailures } = useMonitoringSummary();

  return (
    <nav className="flex h-full flex-col px-6 py-8" aria-label="Main navigation">
      <div className="mb-8 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kafka Connect Console</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage and monitor your data pipelines</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          const showFailureBadge = label === 'Monitoring' && hasFailures;

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                  }`}
                />
                <span className="flex-1">{label}</span>
                {showFailureBadge && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    !
                  </span>
                )}
                {showFailureBadge && (
                  <span className="sr-only">Monitoring has failing connectors</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <ThemeToggle />
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4.5h-4V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClusterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.5 8.5h15M4.5 15.5h15M9 4.5v3M15 4.5v3M9 16.5v3M15 16.5v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="m4 13 3.5-1.5L10 17l3.5-10 3 6 3.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusSquareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5L18 7l1.5 1.5L18 10l-1.5-1.5L15 10l1.5-1.5L15 7l1.5-1.5L18 7l1.5-1.5ZM5.5 15.5 7 17l1.5 1.5L7 20l-1.5-1.5L4 20l1.5-1.5L4 17l1.5-1.5L7 17l-1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 21S4 15 4 9.5C4 7 6 5 8.5 5c1.5 0 3 1 3.5 2.5C12.5 6 14 5 15.5 5 18 5 20 7 20 9.5c0 5.5-8 11.5-8 11.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5-3.75a1 1 0 0 0 .5-.87v-1.76a1 1 0 0 0-.5-.87l-1.66-.96a1 1 0 0 1-.5-.87l-.03-1.92a1 1 0 0 0-.74-.96l-1.9-.5a1 1 0 0 0-1.02.36l-1.16 1.39a1 1 0 0 1-.9.34l-1.77-.26a1 1 0 0 0-1.01.47l-.95 1.65a1 1 0 0 1-.82.5L6.5 9.6a1 1 0 0 0-.87 1l.07 1.99a1 1 0 0 0 .5.87l1.66.96a1 1 0 0 1 .5.87l.03 1.92a1 1 0 0 0 .74.96l1.9.5a1 1 0 0 0 1.02-.36l1.16-1.39a1 1 0 0 1 .9-.34l1.77.26a1 1 0 0 0 1.01-.47l.95-1.65a1 1 0 0 1 .82-.5l1.92-.23Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 12h6m-6 4h6M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
