'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function MonitoringPage() {
  const { summary, loading, error, clusterId } = useMonitoringSummary();
  const [animateRefresh, setAnimateRefresh] = useState(false);
  const previousSummary = useRef(summary);

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

  const connectorsView = useMemo(() => {
    if (!connectors.length) {
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          No connectors reported by the monitoring endpoint.
        </div>
      );
    }

    return (
      <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity duration-500 ${fadeClass}`}>
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
              const tasks = getTasksCount(connector);
              const lastError = getLastError(connector);

              return (
                <tr key={connector.name} className="hover:bg-gray-50 focus-within:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {connector.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles}`}>
                      {state}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{tasks}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span
                      className="block max-h-12 overflow-hidden break-words"
                      title={lastError}
                    >
                      {lastError}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link
                      className="text-blue-600 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      href={`/connectors/${encodeURIComponent(connector.name)}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [connectors, fadeClass]);

  if (loading) {
    return (
      <section className="mx-auto flex max-w-7xl flex-1 items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" aria-hidden />
          <p className="text-sm font-medium text-gray-600">Loading monitoring data…</p>
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
      <header className="mb-10">
        <p className="text-sm font-medium text-gray-500">Cluster: {summary?.clusterId ?? clusterId}</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Monitoring Overview</h1>
        <p className="mt-2 text-sm text-gray-600">Uptime: {uptime}</p>
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

      {connectorsView}
    </section>
  );
}
