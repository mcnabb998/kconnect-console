'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SkeletonBadge, SkeletonCard, SkeletonLine, SkeletonTableRow } from '@/components/Skeleton';

const PROXY = process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';
const DEFAULT_CLUSTER = 'default';

type ConnectorStatus = {
  name: string;
  connector?: {
    state?: string;
    worker_id?: string;
  };
  state?: string;
  tasks?: Array<{
    id?: number;
    state?: string;
    worker_id?: string;
    trace?: string;
    [key: string]: unknown;
  }>;
  type?: string;
  [key: string]: unknown;
};

type ConnectorTask = {
  id?: number;
  state?: string;
  worker_id?: string;
  trace?: string;
  [key: string]: unknown;
};

type WorkerStatus = {
  worker_id?: string;
  worker_host?: string;
  host?: string;
  state?: string;
  status?: string;
  tasks?: Array<unknown> | number;
  version?: string;
  [key: string]: unknown;
};

type ClusterConnector = {
  name: string;
  state: string;
  type?: string;
  workerId?: string;
  tasks: ConnectorTask[];
};

type WorkerSummary = {
  id: string;
  host: string;
  state: string;
  tasks: number;
  raw: WorkerStatus | null;
};

type RebalanceMetadata = {
  state?: string;
  reason?: string;
  durationMs?: number | null;
  lastRebalanceAt?: string | null;
  raw: Record<string, unknown> | null;
};

type ClusterAction = 'restart' | 'rebalance';

const EMPTY_REBALANCE: RebalanceMetadata = {
  state: 'NOT_AVAILABLE',
  reason: 'Rebalance status not supported by this Kafka Connect version',
  durationMs: null,
  lastRebalanceAt: null,
  raw: null,
};

function normalizeState(value?: string | null) {
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim().toUpperCase();
    // Handle special cases for better UX
    if (trimmed === 'NOT_AVAILABLE') {
      return 'NOT AVAILABLE';
    }
    return trimmed;
  }
  return 'UNKNOWN';
}

function formatDuration(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return 'Unknown';
  }

  const milliseconds = value;
  if (milliseconds < 0) {
    return 'Unknown';
  }

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Unknown';
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.toLocaleString();
  }
  return trimmed;
}

function extractNumberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
}

function normalizeRebalance(data: unknown): RebalanceMetadata {
  if (!data || typeof data !== 'object') {
    return { state: undefined, reason: undefined, durationMs: null, lastRebalanceAt: null, raw: null };
  }

  const payload = data as Record<string, unknown>;
  const state = typeof payload.state === 'string' ? payload.state : typeof payload.status === 'string' ? payload.status : undefined;

  const candidatesForReason = ['reason', 'cause', 'message', 'lastReason', 'last_reason'];
  let reason: string | undefined;
  for (const key of candidatesForReason) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      reason = value.trim();
      break;
    }
  }

  if (!reason && typeof payload.last_rebalance === 'object' && payload.last_rebalance !== null) {
    const nested = payload.last_rebalance as Record<string, unknown>;
    for (const key of ['reason', 'cause', 'message']) {
      const value = nested[key];
      if (typeof value === 'string' && value.trim()) {
        reason = value.trim();
        break;
      }
    }
  }

  const durationKeys = ['durationMs', 'duration_ms', 'duration', 'elapsedMs', 'elapsed_ms'];
  let durationMs: number | null = null;
  for (const key of durationKeys) {
    const candidate = extractNumberFromUnknown(payload[key]);
    if (candidate != null) {
      durationMs = candidate;
      break;
    }
  }

  if (durationMs == null && typeof payload.last_rebalance === 'object' && payload.last_rebalance !== null) {
    const nested = payload.last_rebalance as Record<string, unknown>;
    for (const key of ['durationMs', 'duration_ms', 'duration']) {
      const candidate = extractNumberFromUnknown(nested[key]);
      if (candidate != null) {
        durationMs = candidate;
        break;
      }
    }
  }

  const timestampKeys = ['timestamp', 'time', 'lastRebalanceAt', 'completedAt', 'finished_at'];
  let lastRebalanceAt: string | null = null;
  for (const key of timestampKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      lastRebalanceAt = value.trim();
      break;
    }
    if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
      lastRebalanceAt = new Date(value).toISOString();
      break;
    }
  }

  if (!lastRebalanceAt && typeof payload.last_rebalance === 'object' && payload.last_rebalance !== null) {
    const nested = payload.last_rebalance as Record<string, unknown>;
    for (const key of ['timestamp', 'time', 'completedAt']) {
      const value = nested[key];
      if (typeof value === 'string' && value.trim()) {
        lastRebalanceAt = value.trim();
        break;
      }
      if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
        lastRebalanceAt = new Date(value).toISOString();
        break;
      }
    }
  }

  return {
    state,
    reason,
    durationMs,
    lastRebalanceAt,
    raw: payload,
  };
}

function getStateBadgeClasses(state: string) {
  switch (state) {
    case 'RUNNING':
      return 'bg-green-100 text-green-700';
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-100 text-red-700';
    case 'PAUSED':
    case 'REBALANCING':
    case 'DEGRADED':
      return 'bg-yellow-100 text-yellow-700';
    case 'NOT_AVAILABLE':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function ClusterPage() {
  const [connectors, setConnectors] = useState<ClusterConnector[]>([]);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [rebalance, setRebalance] = useState<RebalanceMetadata>(EMPTY_REBALANCE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<ClusterAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const cluster = DEFAULT_CLUSTER;

  const loadCluster = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(null);
        setLoading(true);

        const connectorsRes = await fetch(`${PROXY}/api/${cluster}/connectors`, {
          cache: 'no-store',
          signal,
        });
        if (!connectorsRes.ok) {
          throw new Error(`Unable to fetch connectors (status ${connectorsRes.status})`);
        }
        const connectorNamesPayload = (await connectorsRes.json()) as unknown;
        if (!Array.isArray(connectorNamesPayload)) {
          throw new Error('Unexpected connector list response');
        }
        const connectorNames = connectorNamesPayload as string[];

        const connectorData = await Promise.all(
          connectorNames.map(async (name) => {
            const [statusRes, tasksRes] = await Promise.all([
              fetch(`${PROXY}/api/${cluster}/connectors/${encodeURIComponent(name)}/status`, { cache: 'no-store', signal }),
              fetch(`${PROXY}/api/${cluster}/connectors/${encodeURIComponent(name)}/tasks`, { cache: 'no-store', signal }),
            ]);

            if (!statusRes.ok) {
              throw new Error(`Failed to load status for ${name}`);
            }
            if (!tasksRes.ok) {
              throw new Error(`Failed to load tasks for ${name}`);
            }

            const status = (await statusRes.json()) as ConnectorStatus;
            const tasks = (await tasksRes.json()) as ConnectorTask[];

            // Use task status from the status endpoint, not the tasks endpoint
            // The tasks endpoint returns config data, while status endpoint has state data
            const taskStatuses = Array.isArray(status.tasks) ? status.tasks : [];

            return {
              name,
              state: normalizeState(status.connector?.state ?? status.state ?? undefined),
              type: status.type,
              workerId: status.connector?.worker_id,
              tasks: taskStatuses,
            } satisfies ClusterConnector;
          })
        );

        const workerRes = await fetch(`${PROXY}/api/${cluster}/workers`, { cache: 'no-store', signal });
        let workerPayload: WorkerStatus[] = [];
        if (workerRes.ok) {
          try {
            const parsed = (await workerRes.json()) as unknown;
            if (Array.isArray(parsed)) {
              workerPayload = parsed as WorkerStatus[];
            }
          } catch (err) {
            console.warn('Failed to parse worker payload', err);
          }
        }

        const rebalanceRes = await fetch(`${PROXY}/api/${cluster}/admin/rebalance/status`, { cache: 'no-store', signal });
        if (rebalanceRes.ok) {
          try {
            const payload = (await rebalanceRes.json()) as unknown;
            setRebalance(normalizeRebalance(payload));
          } catch (err) {
            console.warn('Failed to parse rebalance payload', err);
            setRebalance(EMPTY_REBALANCE);
          }
        } else {
          setRebalance(EMPTY_REBALANCE);
        }

        const tasksPerWorker = new Map<string, number>();
        connectorData.forEach((connector) => {
          connector.tasks.forEach((task) => {
            const workerId = typeof task.worker_id === 'string' ? task.worker_id : undefined;
            if (!workerId) {
              return;
            }
            tasksPerWorker.set(workerId, (tasksPerWorker.get(workerId) ?? 0) + 1);
          });
        });

        const workerSummaries: WorkerSummary[] = [];
        const seenWorkers = new Set<string>();

        workerPayload.forEach((worker) => {
          const id = typeof worker.worker_id === 'string' && worker.worker_id ? worker.worker_id : typeof worker.host === 'string' ? worker.host : '';
          if (!id) {
            return;
          }
          seenWorkers.add(id);
          const host = typeof worker.worker_host === 'string' && worker.worker_host ? worker.worker_host : id.split(':')[0] ?? id;
          const state = normalizeState((worker.state ?? worker.status) as string | undefined);
          const tasksCount = typeof worker.tasks === 'number' ? worker.tasks : Array.isArray(worker.tasks) ? worker.tasks.length : tasksPerWorker.get(id) ?? 0;
          tasksPerWorker.delete(id);
          workerSummaries.push({
            id,
            host,
            state,
            tasks: tasksCount,
            raw: worker,
          });
        });

        tasksPerWorker.forEach((count, workerId) => {
          if (seenWorkers.has(workerId)) {
            return;
          }
          // Since workers endpoint is not available, infer state from connector data
          // If a worker has active tasks, it's likely running
          const workerState = count > 0 ? 'RUNNING' : 'UNKNOWN';
          workerSummaries.push({
            id: workerId,
            host: workerId.split(':')[0] ?? workerId,
            state: workerState,
            tasks: count,
            raw: null,
          });
        });

        workerSummaries.sort((a, b) => a.host.localeCompare(b.host));
        setWorkers(workerSummaries);
        setConnectors(connectorData);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error while loading cluster state';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [cluster]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadCluster(controller.signal);
    return () => controller.abort();
  }, [loadCluster]);

  useEffect(() => {
    if (!actionFeedback) {
      return undefined;
    }
    const timeout = setTimeout(() => setActionFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [actionFeedback]);

  const totals = useMemo(() => {
    const summary = {
      total: connectors.length,
      running: 0,
      degraded: 0,
      failed: 0,
    };

    connectors.forEach((connector) => {
      const state = connector.state;
      if (state === 'RUNNING') {
        summary.running += 1;
      } else if (state === 'FAILED' || state === 'ERROR') {
        summary.failed += 1;
      } else {
        summary.degraded += 1;
      }
    });

    return summary;
  }, [connectors]);

  const handleAction = useCallback(
    async (action: ClusterAction) => {
      try {
        setActionFeedback(null);
        setActionInFlight(action);
        const response = await fetch(`${PROXY}/api/${cluster}/cluster/actions/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to ${action} cluster`);
        }

        setActionFeedback({ type: 'success', message: action === 'rebalance' ? 'Rebalance requested' : 'Restart requested' });
        void loadCluster();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Cluster action failed';
        setActionFeedback({ type: 'error', message });
      } finally {
        setActionInFlight(null);
      }
    },
    [cluster, loadCluster]
  );

  const refresh = useCallback(() => {
    void loadCluster();
  }, [loadCluster]);

  const renderConnectorTasks = (connector: ClusterConnector) => {
    if (!connector.tasks.length) {
      return <span className="text-sm text-gray-500">No tasks</span>;
    }
    return (
      <ul className="space-y-1 text-sm text-gray-600">
        {connector.tasks.map((task) => {
          const taskState = normalizeState(task.state ?? undefined);
          const workerId = typeof task.worker_id === 'string' ? task.worker_id : '—';
          const taskId = typeof task.id === 'number' ? task.id : typeof task.id === 'string' ? task.id : '—';
          return (
            <li
              key={`${connector.name}-${taskId}`}
              className="flex items-center justify-between gap-4 rounded-panel border border-gray-200/70 bg-white/60 px-3 py-2 text-xs font-medium dark:border-gray-700/60 dark:bg-slate-900/60"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">Task {taskId}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${getStateBadgeClasses(taskState)}`}>
                {taskState}
              </span>
              <span className="truncate text-gray-500" title={workerId}>
                {workerId}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950" aria-busy="true">
        <header className="bg-white/80 shadow-card dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-2">
              <SkeletonLine width="w-40" height="h-5" />
              <SkeletonLine width="w-64" height="h-4" />
            </div>
            <SkeletonBadge width="w-24" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" role="status" aria-live="polite">
          <div className="grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={index} lines={3} />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={5} />
          </div>
          <div className="mt-6 overflow-hidden rounded-card border border-gray-200/80 bg-white/70 shadow-card backdrop-blur-sm dark:border-gray-700/60 dark:bg-slate-900/50">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <tbody>
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonTableRow key={index} columns={4} />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12 dark:bg-slate-950">
      <header className="bg-white/80 shadow-card backdrop-blur dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Cluster overview</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Inspect workers, tasks, and health for the <span className="font-medium">{cluster}</span> cluster.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={true}
              title="Rebalance operation not supported by this Kafka Connect version"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
            >
              Trigger rebalance (unavailable)
            </button>
            <button
              type="button"
              disabled={true}
              title="Restart all operation not supported by this Kafka Connect version"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
            >
              Restart all connectors (unavailable)
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200" role="alert">
            {error}
          </div>
        )}

        {actionFeedback && (
          <div
            className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium ${
              actionFeedback.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/60 dark:text-green-200'
                : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200'
            }`}
            role="status"
          >
            {actionFeedback.message}
          </div>
        )}

        <section aria-labelledby="cluster-summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-card border border-gray-200/80 bg-white/80 p-5 shadow-card dark:border-gray-700/60 dark:bg-slate-900/60">
            <h2 id="cluster-summary" className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total connectors
            </h2>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{totals.total}</p>
            <p className="mt-1 text-xs text-gray-500">{totals.running} running • {totals.degraded} degraded • {totals.failed} failed</p>
          </div>
          <div className="rounded-card border border-gray-200/80 bg-white/80 p-5 shadow-card dark:border-gray-700/60 dark:bg-slate-900/60">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Workers online</h3>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{workers.length}</p>
            <p className="mt-1 text-xs text-gray-500">{workers.reduce((sum, worker) => sum + worker.tasks, 0)} total tasks</p>
          </div>
          <div className="rounded-card border border-gray-200/80 bg-white/80 p-5 shadow-card dark:border-gray-700/60 dark:bg-slate-900/60">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last rebalance</h3>
            <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {rebalance.lastRebalanceAt ? formatTimestamp(rebalance.lastRebalanceAt) : 'Unknown'}
            </p>
            <p className="mt-1 text-xs text-gray-500">{rebalance.durationMs != null ? `Duration ${formatDuration(rebalance.durationMs)}` : 'Duration unknown'}</p>
          </div>
          <div className="rounded-card border border-gray-200/80 bg-white/80 p-5 shadow-card dark:border-gray-700/60 dark:bg-slate-900/60">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Rebalance state</h3>
            <p className="mt-2 inline-flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStateBadgeClasses(normalizeState(rebalance.state))}`}>
                {normalizeState(rebalance.state)}
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500" title={rebalance.reason ?? undefined}>
              {rebalance.reason ? rebalance.reason : 'No rebalance reason reported'}
            </p>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-card border border-gray-200/80 bg-white/90 p-6 shadow-card dark:border-gray-700/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Connectors</h2>
              <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
                Manage connectors
              </Link>
            </div>
            {connectors.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No connectors found for this cluster.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800/60">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:bg-slate-900/60 dark:text-gray-400">
                    <tr>
                      <th scope="col" className="px-4 py-3 sm:px-6">
                        Connector
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-6">
                        State
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-6">
                        Worker
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-6">
                        Tasks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm dark:divide-gray-800 dark:bg-slate-950/40">
                    {connectors.map((connector) => {
                      const worker = connector.workerId ?? '—';
                      return (
                        <tr key={connector.name} className="transition hover:bg-gray-50/70 dark:hover:bg-slate-900/60">
                          <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100 sm:px-6">
                            <Link href={`/connectors/${encodeURIComponent(connector.name)}`} className="hover:underline">
                              {String(connector.name)}
                            </Link>
                            {connector.type && <p className="mt-1 text-xs text-gray-500">{String(connector.type)}</p>}
                          </td>
                          <td className="px-4 py-4 sm:px-6">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStateBadgeClasses(connector.state)}`}>
                              {String(connector.state)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-600 dark:text-gray-300 sm:px-6" title={worker}>
                            {String(worker)}
                          </td>
                          <td className="px-4 py-4 sm:px-6">
                            {renderConnectorTasks(connector)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-card border border-gray-200/80 bg-white/90 p-6 shadow-card dark:border-gray-700/60 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workers</h2>
                <span className="text-sm text-gray-500">{workers.length} nodes</span>
              </div>
              {workers.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No worker information reported.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {workers.map((worker) => (
                    <li
                      key={worker.id}
                      className="rounded-xl border border-gray-200/80 bg-white/70 p-4 shadow-sm transition hover:border-blue-200 dark:border-gray-700/60 dark:bg-slate-950/60 dark:hover:border-blue-900/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{worker.host}</p>
                          <p className="text-xs text-gray-500" title={worker.id}>
                            {worker.id}
                          </p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStateBadgeClasses(worker.state)}`}>
                          {worker.state}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{typeof worker.tasks === 'number' ? worker.tasks : 0} assigned tasks</span>
                        {worker.raw && typeof worker.raw.version === 'string' && worker.raw.version && <span>v{worker.raw.version}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-card border border-blue-200/70 bg-blue-50/70 p-6 shadow-card dark:border-blue-900/60 dark:bg-blue-950/40">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Rebalance insights</h2>
              <dl className="mt-4 space-y-2 text-sm text-blue-900 dark:text-blue-100">
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium">State</dt>
                  <dd className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStateBadgeClasses(normalizeState(rebalance.state))}`}>
                    {normalizeState(rebalance.state)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium">Duration</dt>
                  <dd>{rebalance.durationMs != null ? formatDuration(rebalance.durationMs) : 'Unknown'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium">Reason</dt>
                  <dd className="max-w-[60%] truncate" title={rebalance.reason ?? undefined}>
                    {rebalance.reason ?? 'No reason provided'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium">Last update</dt>
                  <dd>{rebalance.lastRebalanceAt ? formatTimestamp(rebalance.lastRebalanceAt) : 'Unknown'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
