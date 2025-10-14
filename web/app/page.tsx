'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConnectorBulkActions } from '@/components/ConnectorBulkActions';
import { SkeletonCard, SkeletonLine, SkeletonSurface } from '@/components/Skeleton';
import { performConnectorAction, type ConnectorAction } from '@/lib/api';

const PROXY_URL = 'http://localhost:8080';
const CLUSTER_ID = 'default';

interface ConnectorTaskStatus {
  id: number;
  state: string;
}

interface ConnectorDetails {
  name: string;
  state: string;
  tasks: {
    total: number;
    running: number;
    failed: number;
  };
  plugin: string;
  topics: string;
  updated: string | null;
}

const connectorsEndpoint = `${PROXY_URL}/api/${CLUSTER_ID}/connectors`;

const stateStyles: Record<string, string> = {
  running: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  paused: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  unassigned: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const normalizeState = (value: string) => value?.toLowerCase() ?? 'unknown';

const extractTopics = (config?: Record<string, string>) => {
  if (!config) {
    return '—';
  }

  const topics = config.topics || config.topic || config['topic.regex'];

  if (!topics) {
    return '—';
  }

  if (config.topics) {
    return config.topics
      .split(',')
      .map((topic) => topic.trim())
      .filter(Boolean)
      .join(', ');
  }

  return topics;
};

const formatTasks = (tasks: ConnectorDetails['tasks']) => {
  if (tasks.total === 0) {
    return '—';
  }

  const segments: string[] = [];

  if (tasks.running > 0) {
    segments.push(`${tasks.running} running`);
  }

  if (tasks.failed > 0) {
    segments.push(`${tasks.failed} failed`);
  }

  segments.push(`${tasks.total} total`);

  return segments.join(' • ');
};

export default function Home() {
  const [connectors, setConnectors] = useState<ConnectorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const fetchConnectors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(connectorsEndpoint, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch connectors');
      }
      const data = await response.json();
      const names: string[] = Array.isArray(data) ? data : [];

      const detailedConnectors = await Promise.all(
        names.map(async (name) => {
          try {
            const [statusRes, configRes] = await Promise.all([
              fetch(`${connectorsEndpoint}/${encodeURIComponent(name)}/status`, { cache: 'no-store' }),
              fetch(`${connectorsEndpoint}/${encodeURIComponent(name)}`, { cache: 'no-store' }),
            ]);

            if (!statusRes.ok || !configRes.ok) {
              throw new Error('Failed to fetch connector details');
            }

            const statusData = await statusRes.json();
            const configData = await configRes.json();

            const tasks: ConnectorTaskStatus[] = Array.isArray(statusData?.tasks) ? statusData.tasks : [];
            const runningTasks = tasks.filter((task) => normalizeState(task.state) === 'running').length;
            const failedTasks = tasks.filter((task) => normalizeState(task.state) === 'failed').length;

            const plugin =
              (configData?.config?.['connector.class'] as string | undefined) ||
              (configData?.type as string | undefined) ||
              '—';

            return {
              name,
              state: statusData?.connector?.state ?? 'UNKNOWN',
              tasks: {
                total: tasks.length,
                running: runningTasks,
                failed: failedTasks,
              },
              plugin,
              topics: extractTopics(configData?.config),
              updated: statusData?.connector?.worker_id ?? null,
            } satisfies ConnectorDetails;
          } catch (innerError) {
            console.error(innerError);
            return {
              name,
              state: 'UNKNOWN',
              tasks: {
                total: 0,
                running: 0,
                failed: 0,
              },
              plugin: '—',
              topics: '—',
              updated: null,
            } satisfies ConnectorDetails;
          }
        })
      );

      setConnectors(detailedConnectors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnectorAction = useCallback(
    async (name: string, action: Exclude<ConnectorAction, 'delete'>) => {
      try {
        setActionError(null);
        setActionLoading(`${name}-${action}`);
        await performConnectorAction(name, action);
        await fetchConnectors();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'An error occurred while performing the action');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchConnectors]
  );

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  useEffect(() => {
    setSelectedConnectors((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const currentNames = new Set(connectors.map((connector) => connector.name));
      const retained = new Set<string>();

      previous.forEach((name) => {
        if (currentNames.has(name)) {
          retained.add(name);
        }
      });

      if (retained.size === previous.size) {
        return previous;
      }

      return retained;
    });
  }, [connectors]);

  const filteredConnectors = useMemo(() => {
    return connectors.filter((connector) => {
      const matchesSearch = connector.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
      const matchesState =
        stateFilter === 'all' || normalizeState(connector.state) === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [connectors, searchTerm, stateFilter]);

  const selectedConnectorNames = useMemo(() => Array.from(selectedConnectors), [selectedConnectors]);
  const selectedCount = selectedConnectorNames.length;

  const filteredConnectorNames = useMemo(
    () => filteredConnectors.map((connector) => connector.name),
    [filteredConnectors]
  );

  const filteredSelectedCount = useMemo(
    () => filteredConnectorNames.filter((name) => selectedConnectors.has(name)).length,
    [filteredConnectorNames, selectedConnectors]
  );

  const allFilteredSelected = useMemo(
    () =>
      filteredConnectorNames.length > 0 &&
      filteredConnectorNames.every((name) => selectedConnectors.has(name)),
    [filteredConnectorNames, selectedConnectors]
  );

  const toggleConnectorSelection = useCallback((name: string) => {
    setSelectedConnectors((previous) => {
      const next = new Set(previous);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedConnectors((previous) => {
      if (filteredConnectorNames.length === 0) {
        return previous;
      }

      const next = new Set(previous);
      const shouldUnselect = filteredConnectorNames.every((name) => next.has(name));

      filteredConnectorNames.forEach((name) => {
        if (shouldUnselect) {
          next.delete(name);
        } else {
          next.add(name);
        }
      });

      return next;
    });
  }, [filteredConnectorNames]);

  const clearSelection = useCallback(() => {
    setSelectedConnectors((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      return new Set();
    });
  }, []);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate =
      filteredSelectedCount > 0 && filteredSelectedCount < filteredConnectorNames.length;
  }, [filteredConnectorNames, filteredSelectedCount]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-gray-900">Connectors</h1>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
                Cluster · {CLUSTER_ID}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Monitor and orchestrate Kafka Connect connectors for this cluster.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/connectors/templates"
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              Create Connector
            </Link>
            <button
              type="button"
              onClick={fetchConnectors}
              className="inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>{filteredConnectors.length} shown</span>
            <span className="hidden h-4 w-px bg-slate-200 lg:inline-block" aria-hidden />
            <span>{connectors.length} total</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 sm:w-64">
              <span className="sr-only">Search connectors</span>
              <input
                type="search"
                placeholder="Search connectors"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <span className="sr-only">Filter by state</span>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                className="w-full border-none bg-transparent p-0 text-sm text-slate-900 focus:outline-none"
              >
                <option value="all">All states</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
        </div>
        {selectedCount > 0 && (
          <ConnectorBulkActions
            selected={selectedConnectorNames}
            onClearSelection={clearSelection}
            onActionComplete={fetchConnectors}
          />
        )}
      </div>

      {loading && (
        <div className="space-y-6" role="status" aria-live="polite">
          <span className="sr-only">Loading connectors…</span>
          <SkeletonCard>
            <div className="space-y-4">
              <SkeletonLine width="w-1/3" height="h-4" />
              <div className="grid gap-3 sm:grid-cols-3">
                <SkeletonLine height="h-9" rounded="rounded-pill" />
                <SkeletonLine height="h-9" rounded="rounded-pill" />
                <SkeletonLine height="h-9" rounded="rounded-pill" />
              </div>
            </div>
          </SkeletonCard>

          <SkeletonSurface className="overflow-hidden p-0">
            <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/60">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index} className="px-4 py-4 sm:px-6">
                  <SkeletonLine width="w-1/2" height="h-5" />
                </li>
              ))}
            </ul>
          </SkeletonSurface>
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div
              className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500"
              aria-hidden
            />
            <p className="text-sm text-slate-600">Loading connectors…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="text-lg font-semibold text-rose-700">Error</h2>
          <p className="mt-2 text-sm text-rose-600">{error}</p>
        </div>
      )}

      {actionError && !error && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {actionError}
        </div>
      )}

      {!loading && !error && connectors.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-8 w-8 text-emerald-500"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12h12M12 6v12M7.5 4.5h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-slate-900">No connectors yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Launch your first connector to start moving data. Use templates to accelerate configuration and validation.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/connectors/templates"
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              Create Connector
            </Link>
            <Link
              href="/connectors/templates"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Explore templates
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && connectors.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="w-12 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all shown connectors"
                      checked={allFilteredSelected}
                      onChange={handleSelectAllFiltered}
                      disabled={filteredConnectorNames.length === 0}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    State
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tasks
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Plugin
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Topic(s)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Updated
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredConnectors.map((connector) => {
                  const normalizedState = normalizeState(connector.state);
                  const badgeClass = stateStyles[normalizedState] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20';

                  return (
                    <tr key={connector.name} className="hover:bg-slate-50">
                      <td className="w-12 px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${connector.name}`}
                          checked={selectedConnectors.has(connector.name)}
                          onChange={() => toggleConnectorSelection(connector.name)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-emerald-700">
                        <Link
                          href={`/connectors/${encodeURIComponent(connector.name)}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                        >
                          {connector.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                          {connector.state}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatTasks(connector.tasks)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {connector.plugin}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {connector.topics}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                        {connector.updated ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'pause')}
                            disabled={actionLoading === `${connector.name}-pause`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'resume')}
                            disabled={actionLoading === `${connector.name}-resume`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'restart')}
                            disabled={actionLoading === `${connector.name}-restart`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Restart
                          </button>
                          <Link
                            href={`/connectors/${encodeURIComponent(connector.name)}`}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredConnectors.length === 0 && (
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 text-sm text-slate-600">
              No connectors match your filters.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
