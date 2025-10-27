'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { LoadingButton } from '@/components/LoadingButton';
import { SkeletonBadge, SkeletonCard, SkeletonLine } from '@/components/Skeleton';
import { ToastContainer } from '@/components/ToastContainer';
import { MetricsCard } from '@/components/MetricsCard';
import { SectionErrorBoundary } from '../../components/SectionErrorBoundary';
import TransformationsTab from './TransformationsTab';
import type { ConnectorGetResponse } from '@/types/connect';
import { getProxyUrl, API_CONFIG } from '@/lib/config';
import { useToast } from '@/hooks/useToast';

const PROXY = getProxyUrl();

interface ConnectorStatus {
  name: string;
  connector: {
    state: string;
    worker_id: string;
  };
  tasks: Array<{
    id: number;
    state: string;
    worker_id: string;
  }>;
  type: string;
}

export default function ConnectorDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = params?.name as string;
  const cluster = API_CONFIG.clusterId;
  const { toasts, success, error: showErrorToast, dismissToast } = useToast();

  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [config, setConfig] = useState<ConnectorGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transformations' | 'metrics'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(10);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConnectorDetails = useCallback(async (silent = false) => {
    try {
      // Only show loading skeleton on initial load, not during auto-refresh
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const [statusRes, configRes] = await Promise.all([
        fetch(`${PROXY}/api/${cluster}/connectors/${name}/status`),
        fetch(`${PROXY}/api/${cluster}/connectors/${name}`)
      ]);

      if (!statusRes.ok || !configRes.ok) {
        throw new Error('Failed to fetch connector details');
      }

      const statusData = await statusRes.json();
      const configData: ConnectorGetResponse = await configRes.json();

      setStatus(statusData);
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [name, cluster]);

  useEffect(() => {
    if (name) {
      fetchConnectorDetails();

      // Check if redirected from creation
      if (searchParams.get('created') === 'true') {
        success(`Connector "${name}" created successfully`);
        // Remove the query param from URL using Next.js router
        router.replace(`/connectors/${encodeURIComponent(name)}`, { scroll: false });
      }
    }
  }, [name, searchParams, success, fetchConnectorDetails, router]);

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

    if (!autoRefresh || !name) {
      setNextRefreshIn(10);
      return;
    }

    // Reset countdown
    setNextRefreshIn(10);

    // Countdown timer (updates every second)
    countdownIntervalRef.current = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 0) {
          return 10; // Reset to 10 when it hits 0
        }
        return prev - 1;
      });
    }, 1000);

    // Refresh timer (triggers every 10 seconds)
    // Use silent=true to avoid remounting the UI during background refresh
    refreshIntervalRef.current = setInterval(() => {
      fetchConnectorDetails(true);
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
  }, [autoRefresh, name, fetchConnectorDetails]);

  const handleAction = async (action: 'pause' | 'resume' | 'restart') => {
    try {
      setActionLoading(action);
      setError(null);

      const url = `${PROXY}/api/${cluster}/connectors/${name}/${action}`;
      const method = action === 'restart' ? 'POST' : 'PUT';
      const response = await fetch(url, { method });

      if (!response.ok) {
        // Use simple error messages that match test expectations
        throw new Error(`Failed to ${action} connector`);
      }

      // Show success toast
      success(`Connector ${action}d successfully`);

      // Refresh details after action (silent to avoid UI remount)
      setTimeout(() => {
        fetchConnectorDetails(true);
        setActionLoading(null);
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showErrorToast(errorMessage);
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete connector "${name}"?`)) {
      return;
    }

    try {
      setActionLoading('delete');
      setError(null);

      const response = await fetch(
        `${PROXY}/api/${cluster}/connectors/${name}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        // Use simple error message that matches test expectations
        throw new Error('Failed to delete connector');
      }

      success(`Connector "${name}" deleted successfully`);
      router.push('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showErrorToast(errorMessage);
      setActionLoading(null);
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toUpperCase()) {
      case 'RUNNING':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950" aria-busy={true}>
        <header className="bg-white/80 shadow-card dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <SkeletonLine width="w-16" height="h-4" />
              <SkeletonLine width="w-48" height="h-9" />
            </div>
            <SkeletonBadge width="w-28" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" role="status" aria-live="polite">
          <span className="sr-only">Loading connector details…</span>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonLine key={index} width="w-32" height="h-10" rounded="rounded-pill" />
              ))}
            </div>

            <SkeletonCard>
              <div className="grid gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <SkeletonLine width="w-1/2" height="h-4" />
                    <SkeletonLine width="w-3/4" height="h-6" />
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                <SkeletonLine width="w-1/4" height="h-4" />
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-panel border border-gray-200/70 bg-gray-50/80 p-3 dark:border-gray-700/60 dark:bg-slate-800/70"
                  >
                    <SkeletonLine width="w-24" height="h-4" />
                    <SkeletonBadge width="w-20" />
                  </div>
                ))}
              </div>
            </SkeletonCard>

            <SkeletonCard>
              <div className="space-y-3">
                <SkeletonLine width="w-1/3" height="h-4" />
                <div className="space-y-2 rounded-panel bg-gray-100/70 p-4 dark:bg-slate-800/70">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonLine key={index} width={index % 2 === 0 ? 'w-full' : 'w-4/5'} />
                  ))}
                </div>
              </div>
            </SkeletonCard>
          </div>
        </main>
      </div>
    );
  }

  const tabButton = (tab: 'overview' | 'transformations' | 'metrics', label: string) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === tab
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
      aria-selected={activeTab === tab}
      role="tab"
    >
      {label}
    </button>
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="min-h-screen bg-gray-50">
        <SectionErrorBoundary section="Connector Header">
          <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Link href="/" className="text-blue-500 hover:text-blue-700 mr-4">
                  ← Back
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
              </div>
              <div className="flex items-center gap-3">
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
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {autoRefresh ? `Auto (${nextRefreshIn}s)` : 'Auto: OFF'}
                </button>
                {status && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStateColor(status.connector.state)}`}>
                    {status.connector.state}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>
        </SectionErrorBoundary>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <nav className="mb-6 flex gap-4 border-b" role="tablist" aria-label="Connector detail sections">
            {tabButton('overview', 'Overview')}
            {tabButton('transformations', 'Transformations')}
            {tabButton('metrics', 'Metrics')}
          </nav>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
              )}

              <SectionErrorBoundary section="Action Buttons">
                <div className="flex flex-wrap gap-2">
                  <LoadingButton
                    onClick={() => handleAction('pause')}
                    disabled={status?.connector.state === 'PAUSED' || actionLoading !== null}
                    loading={actionLoading === 'pause'}
                    loadingText="Pausing..."
                    className="bg-yellow-500 hover:bg-yellow-700 focus-visible:outline-yellow-500"
                  >
                    Pause
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => handleAction('resume')}
                    disabled={status?.connector.state !== 'PAUSED' || actionLoading !== null}
                    loading={actionLoading === 'resume'}
                    loadingText="Resuming..."
                    className="bg-green-500 hover:bg-green-700 focus-visible:outline-green-500"
                  >
                    Resume
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => handleAction('restart')}
                    disabled={actionLoading !== null}
                    loading={actionLoading === 'restart'}
                    loadingText="Restarting..."
                    className="bg-blue-500 hover:bg-blue-700 focus-visible:outline-blue-500"
                  >
                    Restart
                  </LoadingButton>
                  <LoadingButton
                    onClick={handleDelete}
                    disabled={actionLoading !== null}
                    loading={actionLoading === 'delete'}
                    loadingText="Deleting..."
                    variant="danger"
                    className="ml-auto"
                  >
                    Delete
                  </LoadingButton>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary section="Status Details">
                {status && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Status</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Connector State</p>
                        <p className="mt-1 text-lg">{status.connector.state}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Worker ID</p>
                        <p className="mt-1 text-lg">{status.connector.worker_id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Type</p>
                        <p className="mt-1 text-lg">{status.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Tasks</p>
                        <p className="mt-1 text-lg">{status.tasks.length}</p>
                      </div>
                    </div>

                    {status.tasks.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3">Tasks</h3>
                        <div className="space-y-2">
                          {status.tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">Task {task.id}</span>
                                <span className="text-gray-500 ml-2">{task.worker_id}</span>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getStateColor(task.state)}`}>
                                {task.state}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionErrorBoundary>

              <SectionErrorBoundary section="Configuration">
                {config && (
                  <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Configuration</h2>
                    <div className="bg-gray-50 rounded p-4 overflow-x-auto">
                      <pre className="text-sm">{JSON.stringify(config.config, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </SectionErrorBoundary>
            </div>
          )}
          
          {activeTab === 'transformations' && (
            <SectionErrorBoundary section="Transformations Tab">
              <TransformationsTab
                name={name}
                initialConnector={config}
                onConfigUpdated={(updated) => {
                  setConfig(updated);
                  fetchConnectorDetails(true);
                }}
              />
            </SectionErrorBoundary>
          )}
          
          {activeTab === 'metrics' && (
            <SectionErrorBoundary section="Metrics Tab">
              <MetricsCard connectorName={name} refreshInterval={5000} />
            </SectionErrorBoundary>
          )}
        </div>
      </main>
      </div>
    </>
  );
}
