'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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

interface ConnectorConfig {
  name: string;
  config: Record<string, any>;
  tasks: Array<{ connector: string; task: number }>;
  type: string;
}

export default function ConnectorDetail() {
  const params = useParams();
  const router = useRouter();
  const name = params?.name as string;
  const cluster = 'default';

  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [config, setConfig] = useState<ConnectorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (name) {
      fetchConnectorDetails();
    }
  }, [name]);

  const fetchConnectorDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, configRes] = await Promise.all([
        fetch(`http://localhost:8080/api/${cluster}/connectors/${name}/status`),
        fetch(`http://localhost:8080/api/${cluster}/connectors/${name}`)
      ]);

      if (!statusRes.ok || !configRes.ok) {
        throw new Error('Failed to fetch connector details');
      }

      const statusData = await statusRes.json();
      const configData = await configRes.json();

      setStatus(statusData);
      setConfig(configData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'restart') => {
    try {
      setActionLoading(true);
      setError(null);

      const url = `http://localhost:8080/api/${cluster}/connectors/${name}/${action}`;
      const response = await fetch(url, { method: 'PUT' });

      if (!response.ok) {
        throw new Error(`Failed to ${action} connector`);
      }

      // Refresh details after action
      setTimeout(() => {
        fetchConnectorDetails();
        setActionLoading(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete connector "${name}"?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:8080/api/${cluster}/connectors/${name}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete connector');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setActionLoading(false);
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading connector details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                href="/"
                className="text-blue-500 hover:text-blue-700 mr-4"
              >
                ← Back
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
            </div>
            {status && (
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStateColor(status.connector.state)}`}>
                {status.connector.state}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading || status?.connector.state === 'PAUSED'}
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pause
            </button>
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading || status?.connector.state !== 'PAUSED'}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Resume
            </button>
            <button
              onClick={() => handleAction('restart')}
              disabled={actionLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Restart
            </button>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              Delete
            </button>
          </div>

          {/* Status */}
          {status && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
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

          {/* Configuration */}
          {config && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              <div className="bg-gray-50 rounded p-4 overflow-x-auto">
                <pre className="text-sm">
                  {JSON.stringify(config.config, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
