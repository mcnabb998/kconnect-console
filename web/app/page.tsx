'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { ConnectorBulkActions } from '@/components/ConnectorBulkActions';
import { LoadingButton } from '@/components/LoadingButton';
import { SkeletonCard, SkeletonLine, SkeletonSurface } from '@/components/Skeleton';
import { ToastContainer } from '@/components/ToastContainer';
import { performConnectorAction, type ConnectorAction } from '@/lib/api';
import { buildApiUrl, API_CONFIG } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { batchFetchSettled } from '@/lib/batchFetch';
import { useToast } from '@/hooks/useToast';

const CLUSTER_ID = API_CONFIG.clusterId;
const ITEMS_PER_PAGE = 20;

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
  workerId: string | null;
}

const connectorsEndpoint = buildApiUrl('/connectors');

const stateStyles: Record<string, string> = {
  running: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/50 dark:text-emerald-400 dark:ring-emerald-500/30',
  paused: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/50 dark:text-amber-400 dark:ring-amber-500/30',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/50 dark:text-rose-400 dark:ring-rose-500/30',
  unassigned: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-500/30',
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

function ConnectorListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, success, error: showErrorToast, dismissToast } = useToast();

  const [connectors, setConnectors] = useState<ConnectorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? Math.max(1, parseInt(page, 10)) : 1;
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(10);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const prevFiltersRef = useRef({ searchTerm: '', stateFilter: 'all' });
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConnectors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingProgress(null);

      const response = await fetchWithTimeout(connectorsEndpoint, { cache: 'no-store', timeout: 30000 });
      if (!response.ok) {
        throw new Error('Failed to fetch connectors');
      }
      const data = await response.json();
      const names: string[] = Array.isArray(data) ? data : [];

      if (names.length === 0) {
        setConnectors([]);
        return;
      }

      // Fetch connector details with concurrency limiting (max 10 concurrent)
      const { successes, failures } = await batchFetchSettled(
        names,
        async (name) => {
          const [statusRes, configRes] = await Promise.all([
            fetchWithTimeout(`${connectorsEndpoint}/${encodeURIComponent(name)}/status`, { cache: 'no-store', timeout: 15000 }),
            fetchWithTimeout(`${connectorsEndpoint}/${encodeURIComponent(name)}`, { cache: 'no-store', timeout: 15000 }),
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
            workerId: statusData?.connector?.worker_id ?? null,
          } satisfies ConnectorDetails;
        },
        {
          concurrency: 10,
          onProgress: (current, total) => {
            setLoadingProgress({ current, total });
          },
        }
      );

      // Combine successes and failures, with fallback data for failures
      const detailedConnectors: ConnectorDetails[] = names.map((name, index) => {
        const success = successes.find(s => s.index === index);
        if (success) {
          return success.result;
        }

        // Find failure and log it
        const failure = failures.find(f => f.index === index);
        if (failure) {
          console.error(`Failed to fetch connector "${name}":`, failure.error);
        }

        // Return fallback data
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
          workerId: null,
        } satisfies ConnectorDetails;
      });

      setConnectors(detailedConnectors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  }, []);

  const handleConnectorAction = useCallback(
    async (name: string, action: Exclude<ConnectorAction, 'delete'>) => {
      try {
        setActionError(null);
        setActionLoading(`${name}-${action}`);
        await performConnectorAction(name, action);
        await fetchConnectors();

        // Show success toast
        const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
        success(`Connector ${action}d successfully`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while performing the action';
        setActionError(errorMessage);
        showErrorToast(errorMessage);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchConnectors, success, showErrorToast]
  );

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  // Auto-refresh logic
  useEffect(() => {
    // Clear any existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!autoRefresh) {
      setNextRefreshIn(10);
      return;
    }

    // Reset countdown
    setNextRefreshIn(10);

    // Countdown timer (updates every second)
    countdownIntervalRef.current = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) {
          return 10; // Reset to 10 when it hits 0
        }
        return prev - 1;
      });
    }, 1000);

    // Refresh timer (triggers every 10 seconds)
    refreshIntervalRef.current = setInterval(() => {
      fetchConnectors();
    }, 10000);

    // Cleanup on unmount or when autoRefresh changes
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [autoRefresh, fetchConnectors]);

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

  // Reset to page 1 when filters change (but not on initial mount)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const searchChanged = prev.searchTerm !== searchTerm;
    const filterChanged = prev.stateFilter !== stateFilter;

    if (searchChanged || filterChanged) {
      // Only reset if this isn't the initial mount (both prev values at defaults)
      const isInitialMount = prev.searchTerm === '' && prev.stateFilter === 'all' && searchTerm === '' && stateFilter === 'all';
      if (!isInitialMount) {
        setCurrentPage(1);
      }
      prevFiltersRef.current = { searchTerm, stateFilter };
    }
  }, [searchTerm, stateFilter]);

  // Sync page number to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage === 1) {
      params.delete('page');
    } else {
      params.set('page', currentPage.toString());
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [currentPage, router, searchParams]);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredConnectors.length / ITEMS_PER_PAGE));
  const paginatedConnectors = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredConnectors.slice(startIndex, endIndex);
  }, [filteredConnectors, currentPage]);

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
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 dark:border-gray-700">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Connectors</h1>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Cluster · {CLUSTER_ID}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
            <LoadingButton
              variant="ghost"
              onClick={fetchConnectors}
              loading={loading}
              loadingText="Refreshing..."
            >
              Refresh
            </LoadingButton>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
              aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {autoRefresh ? `Auto (${nextRefreshIn}s)` : 'Auto: OFF'}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>{filteredConnectors.length} shown</span>
            <span className="hidden h-4 w-px bg-slate-200 lg:inline-block dark:bg-slate-700" aria-hidden />
            <span>{connectors.length} total</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 sm:w-64 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300">
              <span className="sr-only">Search connectors</span>
              <input
                type="search"
                placeholder="Search connectors"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300">
              <span className="sr-only">Filter by state</span>
              <select
                value={stateFilter}
                onChange={(event) => setStateFilter(event.target.value)}
                className="w-full border-none bg-transparent p-0 text-sm text-slate-900 focus:outline-none dark:text-slate-100"
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
            onSuccess={success}
            onError={showErrorToast}
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
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
            <div
              className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500 dark:border-emerald-900 dark:border-t-emerald-400"
              aria-hidden
            />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {loadingProgress
                ? `Loading connectors ${loadingProgress.current}/${loadingProgress.total}…`
                : 'Loading connectors…'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/50 dark:bg-rose-900/20">
          <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-400">Error</h2>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>
        </div>
      )}

      {actionError && !error && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          {actionError}
        </div>
      )}

      {!loading && !error && connectors.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-8 w-8 text-emerald-500 dark:text-emerald-400"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12h12M12 6v12M7.5 4.5h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-slate-900 dark:text-slate-100">No connectors yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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
              className="inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700"
            >
              Explore templates
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && connectors.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="w-12 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all shown connectors"
                      checked={allFilteredSelected}
                      onChange={handleSelectAllFiltered}
                      disabled={filteredConnectorNames.length === 0}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-gray-700"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    State
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Tasks
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Plugin
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Topic(s)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Worker ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-gray-800">
                {paginatedConnectors.map((connector) => {
                  const normalizedState = normalizeState(connector.state);
                  const badgeClass = stateStyles[normalizedState] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20';
                  const connectorNameId = `connector-name-${connector.name.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

                  return (
                    <tr key={connector.name} className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                      <td className="w-12 px-4 py-4">
                        <input
                          type="checkbox"
                          aria-labelledby={connectorNameId}
                          checked={selectedConnectors.has(connector.name)}
                          onChange={() => toggleConnectorSelection(connector.name)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-gray-700"
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-emerald-700">
                        <Link
                          id={connectorNameId}
                          href={`/connectors/${encodeURIComponent(connector.name)}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
                        >
                          {connector.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
                          {connector.state}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatTasks(connector.tasks)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {connector.plugin}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {connector.topics}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 dark:text-slate-500">
                        {connector.workerId ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'pause')}
                            disabled={actionLoading === `${connector.name}-pause`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-gray-700"
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'resume')}
                            disabled={actionLoading === `${connector.name}-resume`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-gray-700"
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConnectorAction(connector.name, 'restart')}
                            disabled={actionLoading === `${connector.name}-restart`}
                            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-gray-700"
                          >
                            Restart
                          </button>
                          <Link
                            href={`/connectors/${encodeURIComponent(connector.name)}`}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-600 dark:text-emerald-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/50"
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
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-400">
              No connectors match your filters.
            </div>
          )}
        </div>
      )}

      {!loading && !error && filteredConnectors.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-slate-700 dark:bg-gray-800">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Showing page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
                {' '}({filteredConnectors.length} total connectors)
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-400 dark:hover:bg-gray-700"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="relative inline-flex items-center border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-400 dark:hover:bg-gray-700"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      </section>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
        </div>
      </section>
    }>
      <ConnectorListPage />
    </Suspense>
  );
}
