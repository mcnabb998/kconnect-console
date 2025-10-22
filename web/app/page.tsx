'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ConnectorBulkActions } from '@/components/ConnectorBulkActions';
import { performConnectorAction, type ConnectorAction } from '@/lib/api';
import { API_CONFIG, buildApiUrl } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { batchFetchSettled } from '@/lib/batchFetch';
import {
  Badge,
  Card,
  DataTable,
  Empty,
  PageHeader,
  Skeleton,
  SkeletonTable,
  SkeletonText,
  Toolbar,
  cn,
  useToast,
} from '@/ui';

const CLUSTER_ID = API_CONFIG.clusterId;
const ITEMS_PER_PAGE = 20;
const connectorsEndpoint = buildApiUrl('/connectors');

type NormalizedState = 'running' | 'paused' | 'degraded' | 'failed' | 'unknown';

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

interface LoadingProgress {
  current: number;
  total: number;
}

const STATE_FILTERS: Array<{ value: 'all' | NormalizedState; label: string }> = [
  { value: 'all', label: 'All states' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'failed', label: 'Failed' },
];

const stateToneClass: Record<NormalizedState, { tone: 'positive' | 'warn' | 'danger' | 'neutral'; className?: string }> = {
  running: { tone: 'positive' },
  paused: { tone: 'warn' },
  degraded: {
    tone: 'warn',
    className:
      'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/40',
  },
  failed: { tone: 'danger' },
  unknown: { tone: 'neutral' },
};

const stateLabel: Record<NormalizedState, string> = {
  running: 'Running',
  paused: 'Paused',
  degraded: 'Degraded',
  failed: 'Failed',
  unknown: 'Unknown',
};

const kebabIcon = (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 4a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 4a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      fill="currentColor"
    />
  </svg>
);

const emptyIcon = (
  <svg
    aria-hidden
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const primaryButtonClasses =
  'inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-70';

const secondaryButtonClasses =
  'inline-flex h-10 items-center justify-center rounded-full border border-[color:var(--border-muted)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--foreground-strong)] shadow-sm transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-70';

const subtleButtonClasses =
  'inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--border-muted)] bg-[color:var(--surface)] px-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]';

function normalizeState(value: string): NormalizedState {
  const normalized = value?.toLowerCase?.() ?? 'unknown';
  if (normalized === 'running') {
    return 'running';
  }
  if (normalized === 'paused') {
    return 'paused';
  }
  if (normalized === 'failed') {
    return 'failed';
  }
  if (normalized === 'degraded') {
    return 'degraded';
  }
  return 'unknown';
}

function extractTopics(config?: Record<string, string>) {
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
}

function formatTasks(tasks: ConnectorDetails['tasks']) {
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
}

interface ActionMenuProps {
  connector: ConnectorDetails;
  loadingKey: string | null;
  onAction: (name: string, action: ConnectorAction) => Promise<void> | void;
}

function RowActionMenu({ connector, loadingKey, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (!menuRef.current) {
        return;
      }
      const target = event.target as Node;
      if (!menuRef.current.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    firstItem?.focus();
  }, [open]);

  const items: Array<{ action: ConnectorAction; label: string; tone: 'default' | 'danger' }> = [
    { action: 'pause', label: 'Pause', tone: 'default' },
    { action: 'resume', label: 'Resume', tone: 'default' },
    { action: 'restart', label: 'Restart', tone: 'default' },
    { action: 'delete', label: 'Delete', tone: 'danger' },
  ];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`connector-${connector.name}-menu`}
        aria-label={`Manage ${connector.name}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {kebabIcon}
      </button>
      {open ? (
        <div
          id={`connector-${connector.name}-menu`}
          ref={menuRef}
          role="menu"
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface)] shadow-lg"
        >
          <div className="flex flex-col py-1">
            {items.map((item) => {
              const key = `${connector.name}-${item.action}`;
              const busy = loadingKey === key;
              const toneClasses =
                item.tone === 'danger'
                  ? 'text-rose-600 hover:bg-rose-50 focus-visible:outline-rose-500 dark:text-rose-300 dark:hover:bg-rose-500/10'
                  : 'text-[color:var(--foreground-strong)] hover:bg-[color:var(--surface-muted)]';

              return (
                <button
                  key={item.action}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]',
                    toneClasses,
                  )}
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    onAction(connector.name, item.action);
                  }}
                >
                  <span>{item.label}</span>
                  {busy ? <span className="text-xs text-[color:var(--muted-foreground)]">…</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConnectorsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <SkeletonText rows={2} widths={["w-1/3", "w-1/4"]} />
      </Card>
      <SkeletonTable columns={7} rows={5} />
    </div>
  );
}

function ConnectorListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { success, error: showErrorToast } = useToast();

  const [connectors, setConnectors] = useState<ConnectorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | NormalizedState>('all');
  const [pluginFilter, setPluginFilter] = useState('all');
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? Math.max(1, parseInt(page, 10)) : 1;
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(10);
  const [isPageActive, setIsPageActive] = useState(true);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownValueRef = useRef(10);
  const autoRefreshRef = useRef(autoRefresh);
  const isPageActiveRef = useRef(isPageActive);

  const updateCountdown = useCallback((value: number) => {
    countdownValueRef.current = value;
    setNextRefreshIn(value);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const fetchConnectors = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const showSkeleton = !silent;
      try {
        if (showSkeleton) {
          setLoading(true);
          setLoadingProgress(null);
        }
        setError(null);

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

        const { successes, failures } = await batchFetchSettled(
          names,
          async (name) => {
            const [statusRes, configRes] = await Promise.all([
              fetchWithTimeout(`${connectorsEndpoint}/${encodeURIComponent(name)}/status`, {
                cache: 'no-store',
                timeout: 15000,
              }),
              fetchWithTimeout(`${connectorsEndpoint}/${encodeURIComponent(name)}`, {
                cache: 'no-store',
                timeout: 15000,
              }),
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
            onProgress: showSkeleton
              ? (current, total) => {
                  setLoadingProgress({ current, total });
                }
              : undefined,
          },
        );

        const detailed = names.map((name, index) => {
          const success = successes.find((entry) => entry.index === index);
          if (success) {
            return success.result;
          }

          const failure = failures.find((entry) => entry.index === index);
          if (failure) {
            console.error(`Failed to fetch connector "${name}":`, failure.error);
          }

          return {
            name,
            state: 'UNKNOWN',
            tasks: { total: 0, running: 0, failed: 0 },
            plugin: '—',
            topics: '—',
            workerId: null,
          } satisfies ConnectorDetails;
        });

        setConnectors(detailed);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load connectors';
        setError(message);
      } finally {
        if (showSkeleton) {
          setLoading(false);
        }
        setLoadingProgress(null);
        if (autoRefreshRef.current && isPageActiveRef.current) {
          updateCountdown(10);
        }
      }
    },
    [updateCountdown],
  );

  const startCountdown = useCallback(() => {
    if (!autoRefreshRef.current || !isPageActiveRef.current) {
      return;
    }

    stopCountdown();
    countdownIntervalRef.current = setInterval(() => {
      const nextValue = countdownValueRef.current - 1;
      if (nextValue <= 0) {
        updateCountdown(10);
        void fetchConnectors({ silent: true });
      } else {
        updateCountdown(nextValue);
      }
    }, 1000);
  }, [fetchConnectors, stopCountdown, updateCountdown]);

  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
    if (!autoRefresh) {
      updateCountdown(10);
      stopCountdown();
    }
  }, [autoRefresh, stopCountdown, updateCountdown]);

  useEffect(() => {
    isPageActiveRef.current = isPageActive;
    if (!isPageActive) {
      stopCountdown();
    }
  }, [isPageActive, stopCountdown]);

  useEffect(() => {
    if (autoRefresh && isPageActive) {
      startCountdown();
      return stopCountdown;
    }
    return undefined;
  }, [autoRefresh, isPageActive, startCountdown, stopCountdown]);

  useEffect(() => {
    void fetchConnectors();
  }, [fetchConnectors]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pluginFilter, searchTerm, stateFilter]);

  useEffect(() => {
    const updateActivity = () => {
      const active = document.visibilityState === 'visible' && document.hasFocus();
      setIsPageActive(active);
    };

    updateActivity();
    document.addEventListener('visibilitychange', updateActivity);
    window.addEventListener('focus', updateActivity);
    window.addEventListener('blur', updateActivity);

    return () => {
      document.removeEventListener('visibilitychange', updateActivity);
      window.removeEventListener('focus', updateActivity);
      window.removeEventListener('blur', updateActivity);
    };
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isTypingField = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
        if (isTypingField) {
          return;
        }
      }

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === 'r') {
        event.preventDefault();
        void fetchConnectors({ silent: connectors.length > 0 });
        return;
      }

      if (event.key === 'a') {
        event.preventDefault();
        setAutoRefresh((prev) => !prev);
        return;
      }

      if (event.key === 'c') {
        event.preventDefault();
        router.push('/connectors/templates');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [connectors.length, fetchConnectors, router]);

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

  useEffect(() => {
    const currentNames = new Set(connectors.map((connector) => connector.name));
    setSelectedConnectors((previous) => {
      const next = new Set<string>();
      previous.forEach((name) => {
        if (currentNames.has(name)) {
          next.add(name);
        }
      });
      return next;
    });
  }, [connectors]);

  const filteredConnectors = useMemo(() => {
    return connectors.filter((connector) => {
      const matchesSearch = connector.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
      const normalizedState = normalizeState(connector.state);
      const matchesState = stateFilter === 'all' || normalizedState === stateFilter;
      const matchesPlugin = pluginFilter === 'all' || connector.plugin === pluginFilter;
      return matchesSearch && matchesState && matchesPlugin;
    });
  }, [connectors, pluginFilter, searchTerm, stateFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredConnectors.length / ITEMS_PER_PAGE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, filteredConnectors.length]);

  const totalPages = Math.max(1, Math.ceil(filteredConnectors.length / ITEMS_PER_PAGE));

  const paginatedConnectors = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredConnectors.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredConnectors]);

  const filteredConnectorNames = useMemo(
    () => filteredConnectors.map((connector) => connector.name),
    [filteredConnectors],
  );

  const filteredSelectedCount = useMemo(
    () => filteredConnectorNames.filter((name) => selectedConnectors.has(name)).length,
    [filteredConnectorNames, selectedConnectors],
  );

  const allFilteredSelected = filteredConnectorNames.length > 0 && filteredSelectedCount === filteredConnectorNames.length;

  const selectedConnectorNames = useMemo(() => Array.from(selectedConnectors), [selectedConnectors]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate =
      filteredSelectedCount > 0 && filteredSelectedCount < filteredConnectorNames.length;
  }, [filteredConnectorNames.length, filteredSelectedCount]);

  const clearSelection = useCallback(() => {
    setSelectedConnectors(new Set());
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedConnectors((previous) => {
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

  const pluginOptions = useMemo(() => {
    const plugins = new Set<string>();
    connectors.forEach((connector) => {
      if (connector.plugin && connector.plugin !== '—') {
        plugins.add(connector.plugin);
      }
    });
    return Array.from(plugins).sort();
  }, [connectors]);

  const handleConnectorAction = useCallback(
    async (name: string, action: ConnectorAction) => {
      if (action === 'delete') {
        const confirmed = window.confirm(`Delete connector "${name}"? This cannot be undone.`);
        if (!confirmed) {
          return;
        }
      }

      try {
        setActionError(null);
        setActionLoading(`${name}-${action}`);
        await performConnectorAction(name, action);
        await fetchConnectors({ silent: true });

        const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
        success(`Connector ${action === 'delete' ? 'deleted' : `${action}d`} successfully`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to perform action';
        setActionError(message);
        showErrorToast(message);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchConnectors, showErrorToast, success],
  );

  const handleRefreshClick = () => {
    void fetchConnectors({ silent: connectors.length > 0 });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        subtitle={`Cluster · ${CLUSTER_ID}`}
        actions={
          <Toolbar>
            <button
              type="button"
              className={primaryButtonClasses}
              onClick={() => router.push('/connectors/templates')}
            >
              Create connector
            </button>
            <button
              type="button"
              className={secondaryButtonClasses}
              onClick={handleRefreshClick}
              aria-label="Refresh connectors"
            >
              Refresh
            </button>
            <button
              type="button"
              className={subtleButtonClasses}
              onClick={() => setAutoRefresh((prev) => !prev)}
              aria-pressed={autoRefresh}
              aria-label={autoRefresh ? 'Disable auto refresh' : 'Enable auto refresh'}
              title={autoRefresh ? 'Auto refresh enabled' : 'Auto refresh disabled'}
            >
              Auto · {autoRefresh ? `${nextRefreshIn}s` : 'off'}
            </button>
          </Toolbar>
        }
      />

      {selectedConnectorNames.length > 0 ? (
        <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40 flex justify-center px-6">
          <ConnectorBulkActions
            className="pointer-events-auto max-w-3xl"
            selected={selectedConnectorNames}
            onClearSelection={clearSelection}
            onActionComplete={() => fetchConnectors({ silent: true })}
            onSuccess={(message) => success(message)}
            onError={(message) => showErrorToast(message)}
          />
        </div>
      ) : null}

      <Card>
        <Toolbar className="gap-3">
          <div className="relative flex min-w-[220px] flex-1 items-center">
            <label htmlFor="connector-search" className="sr-only">
              Search connectors
            </label>
            <input
              id="connector-search"
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search connectors"
              className="h-10 w-full rounded-lg border border-[color:var(--border-muted)] bg-[color:var(--surface-muted)] px-3 text-sm text-[color:var(--foreground-strong)] shadow-inner focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
            <span className="pointer-events-none absolute right-3 text-xs font-medium text-[color:var(--muted-foreground)]">/</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="state-filter" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
              State
            </label>
            <select
              id="state-filter"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}
              className="h-10 rounded-lg border border-[color:var(--border-muted)] bg-[color:var(--surface-muted)] px-3 text-sm font-medium text-[color:var(--foreground-strong)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            >
              {STATE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="plugin-filter" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Plugin
            </label>
            <select
              id="plugin-filter"
              value={pluginFilter}
              onChange={(event) => setPluginFilter(event.target.value)}
              className="h-10 rounded-lg border border-[color:var(--border-muted)] bg-[color:var(--surface-muted)] px-3 text-sm font-medium text-[color:var(--foreground-strong)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            >
              <option value="all">All plugins</option>
              {pluginOptions.map((plugin) => (
                <option key={plugin} value={plugin}>
                  {plugin}
                </option>
              ))}
            </select>
          </div>
        </Toolbar>
        {loading && (
          <div className="mt-4 space-y-3" role="status" aria-live="polite">
            <Skeleton className="h-3 w-24 rounded-full" />
            {loadingProgress ? (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Loading {loadingProgress.current}/{loadingProgress.total}
              </p>
            ) : (
              <p className="text-xs text-[color:var(--muted-foreground)]">Loading connectors…</p>
            )}
          </div>
        )}
      </Card>

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <h2 className="text-sm font-semibold">Unable to load connectors</h2>
          <p className="mt-2 text-sm">{error}</p>
        </Card>
      ) : null}

      {actionError ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="text-sm">{actionError}</p>
        </Card>
      ) : null}

      {!loading && !error && connectors.length === 0 ? (
        <Empty
          icon={emptyIcon}
          title="No connectors yet"
          description="Launch your first connector to start moving data."
          primaryAction={
            <button type="button" className={primaryButtonClasses} onClick={() => router.push('/connectors/templates')}>
              Create connector
            </button>
          }
          secondaryAction={
            <Link
              href="/connectors/templates"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[color:var(--border-muted)] px-4 text-sm font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            >
              Explore capabilities
            </Link>
          }
        />
      ) : null}

      {!loading && !error && connectors.length > 0 ? (
        <DataTable className="shadow-sm">
          <DataTable.Header>
            <tr>
              <DataTable.CheckboxCell>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all filtered connectors"
                  checked={allFilteredSelected}
                  onChange={handleSelectAllFiltered}
                  disabled={filteredConnectorNames.length === 0}
                  className="h-4 w-4 rounded border-[color:var(--border-muted)] text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </DataTable.CheckboxCell>
              <DataTable.HeadCell>Name</DataTable.HeadCell>
              <DataTable.HeadCell>Status</DataTable.HeadCell>
              <DataTable.HeadCell>Tasks</DataTable.HeadCell>
              <DataTable.HeadCell className="font-mono">Plugin</DataTable.HeadCell>
              <DataTable.HeadCell>Topics</DataTable.HeadCell>
              <DataTable.HeadCell className="font-mono">Worker</DataTable.HeadCell>
              <DataTable.ActionCell>Actions</DataTable.ActionCell>
            </tr>
          </DataTable.Header>
          <DataTable.Body>
            {paginatedConnectors.map((connector) => {
              const normalizedState = normalizeState(connector.state);
              const tone = stateToneClass[normalizedState];
              return (
                <DataTable.Row key={connector.name} selected={selectedConnectors.has(connector.name)}>
                  <DataTable.CheckboxCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${connector.name}`}
                      checked={selectedConnectors.has(connector.name)}
                      onChange={() => toggleConnectorSelection(connector.name)}
                      className="h-4 w-4 rounded border-[color:var(--border-muted)] text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                    />
                  </DataTable.CheckboxCell>
                  <DataTable.Cell>
                    <Link
                      href={`/connectors/${encodeURIComponent(connector.name)}`}
                      className="font-semibold text-emerald-600 transition hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    >
                      {connector.name}
                    </Link>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Badge tone={tone.tone} className={tone.className}>
                      {stateLabel[normalizedState] ?? connector.state}
                    </Badge>
                  </DataTable.Cell>
                  <DataTable.Cell className="text-[color:var(--foreground-muted)]">
                    {formatTasks(connector.tasks)}
                  </DataTable.Cell>
                  <DataTable.Cell className="font-mono text-xs text-[color:var(--foreground-muted)]">
                    {connector.plugin}
                  </DataTable.Cell>
                  <DataTable.Cell className="max-w-xs truncate text-[color:var(--foreground-muted)]" title={connector.topics}>
                    {connector.topics}
                  </DataTable.Cell>
                  <DataTable.Cell className="font-mono text-xs text-[color:var(--foreground-muted)]">
                    {connector.workerId ?? '—'}
                  </DataTable.Cell>
                  <DataTable.ActionCell>
                    <RowActionMenu
                      connector={connector}
                      loadingKey={actionLoading}
                      onAction={handleConnectorAction}
                    />
                  </DataTable.ActionCell>
                </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable>
      ) : null}

      {!loading && !error && filteredConnectors.length === 0 && connectors.length > 0 ? (
        <Card className="text-sm text-[color:var(--muted-foreground)]">
          No connectors match your filters.
        </Card>
      ) : null}

      {!loading && filteredConnectors.length > ITEMS_PER_PAGE ? (
        <div className="flex items-center justify-between rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted-foreground)] shadow-sm">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--border-muted)] px-3 font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--border-muted)] px-3 font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ConnectorsSkeleton />}>
      <ConnectorListPage />
    </Suspense>
  );
}
