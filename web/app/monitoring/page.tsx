'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { SkeletonCard, SkeletonLine, SkeletonSurface, SkeletonTableRow } from '@/components/Skeleton';

import { ConnectorSummary, useMonitoringSummary } from './MonitoringSummaryProvider';

function getConnectorState(connector: ConnectorSummary) {
  const rawState = (connector.state ?? connector.status ?? 'UNKNOWN').toString();
  return rawState.toUpperCase();
}

function getStateStyles(state: string) {
  switch (state) {
    case 'RUNNING':
      return 'bg-green-100 text-green-700';
    case 'DEGRADED':
    case 'PAUSED':
      return 'bg-yellow-100 text-yellow-700';
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getTasksCount(connector: ConnectorSummary) {
  if (typeof connector.tasks === 'number') {
    return connector.tasks;
  }
  if (Array.isArray(connector.tasks)) {
    return connector.tasks.length;
  }
  if (typeof connector.tasksCount === 'number') {
    return connector.tasksCount;
  }
  return 0;
}

function getLastError(connector: ConnectorSummary) {
  if (typeof connector.lastError === 'string' && connector.lastError.trim().length > 0) {
    return connector.lastError;
  }
  if (typeof connector.trace === 'string' && connector.trace.trim().length > 0) {
    return connector.trace;
  }
  return '—';
}

function formatTimestamp(value: unknown) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return new Date(value).toLocaleString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toLocaleString();
    }
    if (value.trim().length > 0) {
      return value;
    }
  }
  return 'Unknown';
}

function getConnectorTimestamp(connector: ConnectorSummary) {
  const candidateKeys = ['lastSeen', 'timestamp', 'updatedAt', 'lastUpdated', 'observedAt'];
  for (const key of candidateKeys) {
    const value = connector[key as keyof ConnectorSummary];
    if (value != null) {
      return formatTimestamp(value);
    }
  }
  return 'Unknown';
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 20 20"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export default function MonitoringPage() {
  const {
    summary,
    loading,
    error,
    clusterId,
    isPolling,
    pausePolling,
    resumePolling,
    refresh,
  } = useMonitoringSummary();
  const [animateRefresh, setAnimateRefresh] = useState(false);
  const previousSummary = useRef(summary);
  const [activeTab, setActiveTab] = useState<'overview' | 'problems'>('overview');
  const [expandedConnectors, setExpandedConnectors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!summary) {
      previousSummary.current = summary;
      return;
    }

    if (previousSummary.current && summary !== previousSummary.current) {
      setAnimateRefresh(true);
      const timeout = setTimeout(() => setAnimateRefresh(false), 400);
      previousSummary.current = summary;
      return () => clearTimeout(timeout);
    }

    previousSummary.current = summary;
  }, [summary]);

  const totals = summary?.totals ?? {};
  const uptime = summary?.uptime ?? 'Unknown uptime';
  const connectors = summary?.connectors ?? [];
  const totalConnectors = totals.total ?? connectors.length;
  const running = totals.running ?? 0;
  const degraded = totals.degraded ?? 0;
  const failed = totals.failed ?? 0;

  const fadeClass = animateRefresh ? 'opacity-95' : 'opacity-100';

  useEffect(() => {
    setExpandedConnectors((prev) => {
      if (!Object.keys(prev).length) {
        return prev;
      }
      const validNames = new Set(connectors.map((connector) => connector.name));
      const next: Record<string, boolean> = {};
      for (const name of validNames) {
        if (prev[name]) {
          next[name] = true;
        }
      }
      return next;
    });
  }, [connectors]);

  const problemConnectors = useMemo(() => {
    return connectors
      .filter((connector) => {
        const state = getConnectorState(connector);
        return state === 'DEGRADED' || state === 'FAILED' || state === 'ERROR';
      })
      .sort((a, b) => {
        const priority = (state: string) => {
          switch (state) {
            case 'FAILED':
            case 'ERROR':
              return 0;
            case 'DEGRADED':
              return 1;
            default:
              return 2;
          }
        };
        return priority(getConnectorState(a)) - priority(getConnectorState(b));
      });
  }, [connectors]);

  const toggleConnector = (name: string) => {
    setExpandedConnectors((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const renderTasks = (connector: ConnectorSummary) => {
    if (Array.isArray(connector.tasks) && connector.tasks.length > 0) {
      const formatTaskValue = (value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          try {
            return JSON.stringify(value);
          } catch (err) {
            return '[object Object]';
          }
        }
        return String(value);
      };

      return (
        <ul className="mt-2 space-y-2">
          {connector.tasks.map((task, index) => {
            const taskInfo =
              typeof task === 'object' && task !== null ? (task as Record<string, unknown>) : null;
            const taskState = taskInfo && typeof taskInfo.state === 'string' ? taskInfo.state.toUpperCase() : null;
            const additionalEntries = taskInfo
              ? Object.entries(taskInfo).filter(([key, value]) => key !== 'state' && value != null)
              : [];

            return (
              <li key={index} className="rounded border border-gray-200 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-gray-600">
                  <span>
                    Task {taskInfo && taskInfo['id'] != null ? String(taskInfo['id']) : index + 1}
                  </span>
                  {taskState ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${getStateStyles(taskState)}`}>
                      {taskState}
                    </span>
                  ) : null}
                </div>
                {additionalEntries.length ? (
                  <dl className="mt-2 space-y-1 text-xs text-gray-600">
                    {additionalEntries.map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-2">
                        <dt className="font-medium text-gray-700">{key}</dt>
                        <dd className="text-right text-gray-600">{formatTaskValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">No additional metadata provided.</p>
                )}
              </li>
            );
          })}
        </ul>
      );
    }

    if (typeof connector.tasks === 'number') {
      return (
        <p className="mt-2 text-xs text-gray-600">Reported task slots: {connector.tasks}</p>
      );
    }

    if (typeof connector.tasksCount === 'number') {
      return (
        <p className="mt-2 text-xs text-gray-600">Reported task slots: {connector.tasksCount}</p>
      );
    }

    return <p className="mt-2 text-xs text-gray-500">No task details available for this connector.</p>;
  };

  const connectorsContent = connectors.length ? (
    <div
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity duration-500 ${fadeClass}`}
    >
      <table className="min-w-full divide-y divide-gray-200" role="table">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Connector
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              State
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Tasks
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Last error
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {connectors.map((connector) => {
            const state = getConnectorState(connector);
            const badgeStyles = getStateStyles(state);
            const tasksCount = getTasksCount(connector);
            const lastError = getLastError(connector);
            const isExpanded = Boolean(expandedConnectors[connector.name]);

            return (
              <Fragment key={connector.name}>
                <tr className="group relative hover:bg-gray-50 focus-within:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    <button
                      aria-expanded={isExpanded}
                      className="flex items-center gap-2 text-left text-sm font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      onClick={() => toggleConnector(connector.name)}
                      type="button"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                        <ChevronDownIcon
                          className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                        />
                      </span>
                      <span className="truncate">{connector.name}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles}`}>
                      {state}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{tasksCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="block max-h-12 overflow-hidden break-words" title={lastError}>
                      {lastError}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end">
                      <div className="flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        <Link
                          className="inline-flex items-center rounded-md border border-transparent bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          href={`/connectors/${encodeURIComponent(connector.name)}`}
                        >
                          View
                        </Link>
                        <button
                          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          onClick={() => refresh()}
                          type="button"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="bg-gray-50">
                    <td className="px-6 pb-6 pt-0 text-sm text-gray-700" colSpan={5}>
                      <div className="pt-4">
                        <div className="flex flex-col gap-6 md:flex-row md:gap-10">
                          <div className="md:w-1/2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tasks</h3>
                              <p className="text-xs text-gray-500">Last updated: {getConnectorTimestamp(connector)}</p>
                            </div>
                            {renderTasks(connector)}
                          </div>
                          <div className="md:w-1/2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last error</h3>
                            <div className="mt-2 whitespace-pre-wrap rounded border border-gray-200 bg-white/70 p-3 text-xs text-gray-700">
                              {lastError !== '—' ? lastError : 'No recent errors reported.'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
      No connectors reported by the monitoring endpoint.
    </div>
  );

  const problemsCount = problemConnectors.length;

  const problemsContent = (
    <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Problems</h2>
          <p className="mt-1 text-sm text-gray-600">Connectors reporting degraded or failed states.</p>
        </div>
        {problemConnectors.length ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-700">
            {problemConnectors.length}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {problemConnectors.length ? (
          problemConnectors.map((connector) => {
            const state = getConnectorState(connector);
            const badgeStyles = getStateStyles(state);
            const timestamp = getConnectorTimestamp(connector);
            const lastError = getLastError(connector);

            return (
              <div key={connector.name} className="rounded border border-red-100 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-red-700">{connector.name}</p>
                    <p className="mt-1 text-xs text-red-600">Last updated: {timestamp}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyles}`}>
                    {state}
                  </span>
                </div>
                <div className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap text-sm text-red-700">
                  {lastError !== '—' ? lastError : 'No error details supplied.'}
                </div>
                <div className="mt-3">
                  <Link
                    className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    href={`/connectors/${encodeURIComponent(connector.name)}`}
                  >
                    View connector
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-600">No degraded or failed connectors at the moment.</p>
        )}
      </div>
    </aside>
  );

  if (loading) {
    return (
      <section
        className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
        aria-busy={true}
      >
        <div className="space-y-10" role="status" aria-live="polite">
          <span className="sr-only">Loading monitoring overview…</span>

          <header className="space-y-3">
            <SkeletonLine width="w-40" height="h-4" />
            <SkeletonLine width="w-1/2" height="h-9" />
            <SkeletonLine width="w-48" height="h-4" />
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index}>
                <div className="space-y-4">
                  <SkeletonLine width="w-2/3" height="h-4" />
                  <SkeletonLine width="w-1/3" height="h-8" />
                </div>
              </SkeletonCard>
            ))}
          </div>

          <SkeletonSurface className="overflow-hidden p-0">
            <div className="border-b border-gray-200/70 bg-gray-50/80 px-4 py-4 dark:border-gray-700/60 dark:bg-slate-800/60 sm:px-6">
              <SkeletonLine width="w-40" height="h-5" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200/70 dark:divide-gray-700/60" role="table">
                <thead className="bg-gray-50/70 dark:bg-slate-800/70">
                  <tr>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <th key={index} scope="col" className="px-4 py-3 text-left sm:px-6">
                        <SkeletonLine width="w-1/3" height="h-3" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/60">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <SkeletonTableRow
                      key={index}
                      columns={5}
                      widths={['w-3/5', 'w-24', 'w-16', 'w-4/5', 'w-20']}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SkeletonSurface>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-700">Unable to load monitoring data</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Cluster: {summary?.clusterId ?? clusterId}</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Monitoring Overview</h1>
          <p className="mt-2 text-sm text-gray-600">Uptime: {uptime}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isPolling ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  isPolling ? 'bg-green-400 opacity-75 animate-ping' : 'bg-gray-400 opacity-30'
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isPolling ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />
            </span>
            {isPolling ? 'Live' : 'Paused'}
          </span>
          <button
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            onClick={isPolling ? pausePolling : resumePolling}
            type="button"
          >
            {isPolling ? 'Pause' : 'Resume'} monitoring
          </button>
        </div>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total connectors</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalConnectors}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">🟢 Running</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{running}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">🟡 Degraded</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-700">{degraded}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">🔴 Failed</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{failed}</p>
        </div>
      </div>

      {failed > 0 && (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-semibold text-red-700">Attention required</h2>
          <p className="mt-2 text-sm text-red-600">
            {failed === 1
              ? '1 connector is reporting a failure. Investigate the error details below.'
              : `${failed} connectors are reporting failures. Investigate the error details below.`}
          </p>
        </div>
      )}

      <div className="xl:hidden">
        <div className="mb-6 inline-flex rounded-full bg-gray-100 p-1 text-sm font-semibold text-gray-600">
          <button
            className={`rounded-full px-4 py-2 transition ${
              activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('overview')}
            type="button"
          >
            Overview
          </button>
          <button
            className={`rounded-full px-4 py-2 transition ${
              activeTab === 'problems' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('problems')}
            type="button"
          >
            Problems{problemsCount ? ` (${problemsCount})` : ''}
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === 'overview' ? connectorsContent : problemsContent}
        </div>
      </div>

      <div className="hidden xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:gap-8">
        <div className="space-y-6">{connectorsContent}</div>
        {problemsContent}
      </div>
    </section>
  );
}
