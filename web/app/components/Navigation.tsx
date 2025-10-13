'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMonitoringSummary } from '../monitoring/MonitoringSummaryProvider';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/monitoring', label: 'Monitoring' },
  { href: '/connectors/templates', label: 'Create Connector' },
  { href: '/capabilities', label: 'Capabilities' },
];

export function Navigation() {
  const pathname = usePathname();
  const { hasFailures } = useMonitoringSummary();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm" aria-label="Main navigation">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-lg font-semibold text-gray-900">Kafka Connect Console</p>
        <div className="flex items-center gap-6">
          {navItems.map(({ href, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            const baseClasses =
              'relative text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';
            const activeClasses = isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900';
            const showFailureDot = label === 'Monitoring' && hasFailures;

            return (
              <Link key={href} href={href} className={`${baseClasses} ${activeClasses}`}>
                <span>{label}</span>
                {showFailureDot && (
                  <span className="absolute -right-3 -top-1 inline-flex h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                )}
                {showFailureDot && (
                  <span className="sr-only">Monitoring has failing connectors</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
