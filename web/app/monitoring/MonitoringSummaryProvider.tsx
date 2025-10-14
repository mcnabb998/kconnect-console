'use client';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface MonitoringTotals {
  total: number;
  running: number;
  degraded: number;
  failed: number;
  [key: string]: number;
}

export interface ConnectorSummary {
  name: string;
  state?: string;
  status?: string;
  tasks?: number | { state?: string }[];
  tasksCount?: number;
  lastError?: string | null;
  trace?: string | null;
  [key: string]: unknown;
}

export interface MonitoringSummary {
  clusterId?: string;
  uptime?: string;
  totals?: MonitoringTotals;
  connectors?: ConnectorSummary[];
  [key: string]: unknown;
}

interface MonitoringSummaryContextValue {
  apiBaseUrl: string;
  clusterId: string;
  uptime: string;
  summary: MonitoringSummary | null;
  loading: boolean;
  error: string | null;
  isRefreshing: boolean;
  hasFailures: boolean;
  isPolling: boolean;
  pausePolling: () => void;
  resumePolling: () => void;
  refresh: () => Promise<void>;
}

const MonitoringSummaryContext = createContext<MonitoringSummaryContextValue | undefined>(
  undefined,
);

const DEFAULT_PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';
const DEFAULT_CLUSTER_ID = process.env.NEXT_PUBLIC_CLUSTER_ID ?? 'default';
const POLLING_INTERVAL_MS = 10_000;

export function MonitoringSummaryProvider({ children }: PropsWithChildren) {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const hasMountedRef = useRef(true);
  const isInitialFetch = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const apiBaseUrl = DEFAULT_PROXY_URL;
  const clusterId = summary?.clusterId?.trim() ? summary.clusterId : DEFAULT_CLUSTER_ID;
  const summaryUrl = `${apiBaseUrl}/api/${clusterId}/monitoring/summary`;

  const fetchSummary = useCallback(async () => {
    try {
      setError(null);
      if (!isInitialFetch.current) {
        setIsRefreshing(true);
      }
      const response = await fetch(summaryUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring summary');
      }
      const payload = (await response.json()) as MonitoringSummary;
      if (hasMountedRef.current) {
        setSummary(payload);
        setLoading(false);
      }
    } catch (err) {
      if (hasMountedRef.current) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setLoading(false);
      }
    } finally {
      if (hasMountedRef.current) {
        if (isInitialFetch.current) {
          isInitialFetch.current = false;
        }
        if (!isInitialFetch.current) {
          setTimeout(() => {
            if (hasMountedRef.current) {
              setIsRefreshing(false);
            }
          }, 400);
        } else {
          setIsRefreshing(false);
        }
      }
    }
  }, [summaryUrl]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return;
    }
    pollingIntervalRef.current = setInterval(() => {
      void fetchSummary();
    }, POLLING_INTERVAL_MS);
  }, [fetchSummary]);

  useEffect(() => {
    hasMountedRef.current = true;
    void fetchSummary();
    return () => {
      hasMountedRef.current = false;
      stopPolling();
    };
  }, [fetchSummary, stopPolling]);

  useEffect(() => {
    if (isPaused) {
      stopPolling();
      return;
    }
    startPolling();
    return () => {
      stopPolling();
    };
  }, [isPaused, startPolling, stopPolling]);

  const pausePolling = useCallback(() => {
    setIsPaused(true);
    stopPolling();
  }, [stopPolling]);

  const resumePolling = useCallback(() => {
    setIsPaused(false);
    void fetchSummary();
  }, [fetchSummary]);

  const hasFailures = (summary?.totals?.failed ?? 0) > 0;
  const uptime = summary?.uptime?.trim() ? summary.uptime : 'unknown';

  const value = useMemo<MonitoringSummaryContextValue>(
    () => ({
      apiBaseUrl,
      clusterId,
      uptime,
      summary,
      loading,
      error,
      isRefreshing,
      hasFailures,
      isPolling: !isPaused,
      pausePolling,
      resumePolling,
      refresh: fetchSummary,
    }),
    [
      apiBaseUrl,
      clusterId,
      error,
      fetchSummary,
      hasFailures,
      isPaused,
      isRefreshing,
      loading,
      pausePolling,
      resumePolling,
      summary,
      uptime,
    ],
  );

  return (
    <MonitoringSummaryContext.Provider value={value}>
      {children}
    </MonitoringSummaryContext.Provider>
  );
}

export function useMonitoringSummary() {
  const context = useContext(MonitoringSummaryContext);
  if (!context) {
    throw new Error('useMonitoringSummary must be used within a MonitoringSummaryProvider');
  }
  return context;
}
