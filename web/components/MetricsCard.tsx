'use client';

import { useEffect, useState } from 'react';
import { fetchConnectorMetrics } from '@/lib/api';
import type { ConnectorMetrics, MetricsSnapshot } from '@/types/connect';

interface MetricsCardProps {
  connectorName: string;
  refreshInterval?: number; // in milliseconds, default 5000
}

export function MetricsCard({ connectorName, refreshInterval = 5000 }: MetricsCardProps) {
  const [metrics, setMetrics] = useState<ConnectorMetrics | null>(null);
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const loadMetrics = async () => {
      try {
        const data = await fetchConnectorMetrics(connectorName);
        
        if (mounted) {
          setMetrics(data);
          setError(null);
          
          // Add to history for charting
          const snapshot: MetricsSnapshot = {
            timestamp: new Date(data.lastUpdated).getTime(),
            recordsPerSecond: data.throughput.recordsPerSecond,
            bytesPerSecond: data.throughput.bytesPerSecond,
            errorRate: data.errors.errorRate,
            totalRecords: data.throughput.totalRecords,
            totalErrors: data.errors.totalErrors,
          };
          
          setHistory(prev => {
            const updated = [...prev, snapshot];
            // Keep last 60 data points (5 minutes at 5-second intervals)
            return updated.slice(-60);
          });
          
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
          setLoading(false);
        }
      }
    };

    loadMetrics();
    
    if (refreshInterval > 0) {
      intervalId = setInterval(loadMetrics, refreshInterval);
    }

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [connectorName, refreshInterval]);

  if (loading && !metrics) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded bg-gray-200 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 rounded bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Metrics Unavailable</h3>
            <p className="mt-1 text-sm text-yellow-700">
              {error}. Metrics require JMX/Jolokia to be configured on Kafka Connect.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) {
      return `${(bytes / 1073741824).toFixed(2)} GB`;
    }
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  const formatRate = (rate: number) => {
    return rate.toFixed(2);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
          <span className="text-xs text-gray-500">
            Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Throughput Metrics */}
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Throughput</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricBox
              label="Records/sec"
              value={formatRate(metrics.throughput.recordsPerSecond)}
              icon="📊"
            />
            <MetricBox
              label="Bytes/sec"
              value={formatBytes(metrics.throughput.bytesPerSecond)}
              icon="💾"
            />
            <MetricBox
              label="Total Records"
              value={formatNumber(metrics.throughput.totalRecords)}
              icon="📈"
            />
            <MetricBox
              label="Total Bytes"
              value={formatBytes(metrics.throughput.totalBytes)}
              icon="💿"
            />
          </div>
        </div>

        {/* Error Metrics */}
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">Errors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricBox
              label="Total Errors"
              value={formatNumber(metrics.errors.totalErrors)}
              icon="❌"
              variant={metrics.errors.totalErrors > 0 ? 'error' : 'default'}
            />
            <MetricBox
              label="Error Rate"
              value={`${formatRate(metrics.errors.errorRate)}%`}
              icon="⚠️"
              variant={metrics.errors.errorRate > 5 ? 'warning' : 'default'}
            />
            <MetricBox
              label="Recent Errors"
              value={formatNumber(metrics.errors.recentErrorCount)}
              icon="🔴"
              variant={metrics.errors.recentErrorCount > 0 ? 'error' : 'default'}
            />
          </div>
        </div>

        {/* Task Metrics */}
        {metrics.tasks && metrics.tasks.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-700">Tasks</h4>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Task ID</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">State</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Records</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Bytes</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {metrics.tasks.map(task => (
                    <tr key={task.taskId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{task.taskId}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          task.state === 'RUNNING' ? 'bg-green-100 text-green-700' :
                          task.state === 'FAILED' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {task.state}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">
                        {formatNumber(task.recordsProcessed)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">
                        {formatBytes(task.bytesProcessed)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        <span className={task.errorCount > 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                          {formatNumber(task.errorCount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Simple historical trend indicator */}
        {history.length > 1 && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Recent Trend</h4>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Records:</span>
                <TrendIndicator
                  current={history[history.length - 1].recordsPerSecond}
                  previous={history[history.length - 2].recordsPerSecond}
                />
              </div>
              <div className="flex items-center gap-2">
                <span>Errors:</span>
                <TrendIndicator
                  current={history[history.length - 1].totalErrors}
                  previous={history[history.length - 2].totalErrors}
                  inverse
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: string | number;
  icon?: string;
  variant?: 'default' | 'warning' | 'error';
}

function MetricBox({ label, value, icon, variant = 'default' }: MetricBoxProps) {
  const bgColor = {
    default: 'bg-blue-50',
    warning: 'bg-yellow-50',
    error: 'bg-red-50',
  }[variant];

  const textColor = {
    default: 'text-blue-900',
    warning: 'text-yellow-900',
    error: 'text-red-900',
  }[variant];

  return (
    <div className={`rounded-lg ${bgColor} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${textColor}`}>{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

interface TrendIndicatorProps {
  current: number;
  previous: number;
  inverse?: boolean; // For metrics where decrease is good (e.g., errors)
}

function TrendIndicator({ current, previous, inverse = false }: TrendIndicatorProps) {
  const diff = current - previous;
  const isUp = diff > 0;
  const isGood = inverse ? !isUp : isUp;
  
  if (Math.abs(diff) < 0.01) {
    return <span className="text-gray-500">→ Stable</span>;
  }

  return (
    <span className={isGood ? 'text-green-600' : 'text-red-600'}>
      {isUp ? '↗' : '↘'} {isGood ? 'Good' : 'Alert'}
    </span>
  );
}
