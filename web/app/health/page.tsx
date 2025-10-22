'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'checking';
  kafka_connect?: {
    status: string;
    url: string;
  };
  timestamp?: string;
  error?: string;
}

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'checking';
  message?: string;
  latency?: number;
}

// Icon components
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
    </svg>
  );
}

export default function HealthPage() {
  const [proxyHealth, setProxyHealth] = useState<HealthStatus>({ status: 'checking' });
  const [kafkaConnectHealth, setKafkaConnectHealth] = useState<ServiceCheck>({
    name: 'Kafka Connect',
    status: 'checking',
  });
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const checkHealth = async () => {
    const checkStart = Date.now();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PROXY_URL}/health`);
      const data = await response.json();
      const latency = Date.now() - checkStart;

      setProxyHealth({
        status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
        kafka_connect: data.kafka_connect,
        timestamp: new Date().toISOString(),
      });

      // Check if kafka_connect exists and has status "reachable"
      const isConnectHealthy = data.kafka_connect?.status === 'reachable';

      setKafkaConnectHealth({
        name: 'Kafka Connect',
        status: isConnectHealthy ? 'healthy' : 'unhealthy',
        message: isConnectHealthy
          ? `Connected successfully to ${data.kafka_connect?.url || 'Kafka Connect'}`
          : 'Unable to connect to Kafka Connect',
        latency,
      });

      setLastCheck(new Date());
    } catch (error) {
      setProxyHealth({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      setKafkaConnectHealth({
        name: 'Kafka Connect',
        status: 'unhealthy',
        message: 'Proxy unreachable',
      });

      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    checkHealth();

    if (autoRefresh) {
      const interval = setInterval(checkHealth, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'healthy') {
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
    } else if (status === 'unhealthy') {
      return <XCircleIcon className="h-6 w-6 text-red-500" />;
    } else {
      return <ClockIcon className="h-6 w-6 text-yellow-500 animate-pulse" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return 'bg-green-50 border-green-200';
    if (status === 'unhealthy') return 'bg-red-50 border-red-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'healthy') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Healthy</span>;
    } else if (status === 'unhealthy') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Unhealthy</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Checking...</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">System Health</h1>
          <p className="text-gray-600">
            Monitor the health of kconnect-console and its dependencies
          </p>
        </div>

        {/* Overall Status */}
        <div className={`p-6 rounded-lg border-2 mb-6 ${getStatusColor(proxyHealth.status)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <StatusIcon status={proxyHealth.status} />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Overall Status</h2>
                <p className="text-sm text-gray-600">
                  Last checked: {lastCheck.toLocaleTimeString()}
                </p>
              </div>
            </div>
            {getStatusBadge(proxyHealth.status)}
          </div>

          {proxyHealth.error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded text-sm text-red-800">
              <strong>Error:</strong> {proxyHealth.error}
            </div>
          )}
        </div>

        {/* Service Checks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Service Checks</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {/* Proxy Check */}
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={proxyHealth.status} />
                  <div>
                    <h3 className="font-semibold text-gray-900">kconnect-console Proxy</h3>
                    <p className="text-sm text-gray-600">
                      {proxyHealth.status === 'healthy'
                        ? 'API proxy is running'
                        : proxyHealth.status === 'unhealthy'
                        ? 'Proxy is not responding'
                        : 'Checking proxy status...'}
                    </p>
                  </div>
                </div>
                {getStatusBadge(proxyHealth.status)}
              </div>
            </div>

            {/* Kafka Connect Check */}
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={kafkaConnectHealth.status} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{kafkaConnectHealth.name}</h3>
                    <p className="text-sm text-gray-600">
                      {kafkaConnectHealth.message || 'Checking connection...'}
                    </p>
                    {kafkaConnectHealth.latency && (
                      <p className="text-xs text-gray-500 mt-1">
                        Response time: {kafkaConnectHealth.latency}ms
                      </p>
                    )}
                  </div>
                </div>
                {getStatusBadge(kafkaConnectHealth.status)}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Controls</h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={checkHealth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Check Now
            </button>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto-refresh (every 10s)</span>
            </label>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-semibold text-gray-700">Proxy URL</dt>
              <dd className="text-gray-600 mt-1">{process.env.NEXT_PUBLIC_PROXY_URL || 'Not configured'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">Cluster ID</dt>
              <dd className="text-gray-600 mt-1">{process.env.NEXT_PUBLIC_CLUSTER_ID || 'default'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">Environment</dt>
              <dd className="text-gray-600 mt-1">{process.env.NODE_ENV || 'production'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">Last Health Check</dt>
              <dd className="text-gray-600 mt-1">{lastCheck.toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        {/* Troubleshooting Tips */}
        {proxyHealth.status === 'unhealthy' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Troubleshooting Tips</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Verify the proxy service is running: <code className="bg-yellow-100 px-1 rounded">docker ps</code> or <code className="bg-yellow-100 px-1 rounded">kubectl get pods</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Check proxy logs for errors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Verify KAFKA_CONNECT_URL environment variable is set correctly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Ensure network connectivity between proxy and Kafka Connect</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Test Kafka Connect directly: <code className="bg-yellow-100 px-1 rounded">curl http://your-kafka-connect:8083/</code></span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
