'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SkeletonCard, SkeletonLine } from '@/components/Skeleton';
import { getProxyUrl, API_CONFIG } from '@/lib/config';

const PROXY = getProxyUrl();
const DEFAULT_CLUSTER = API_CONFIG.clusterId;

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

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get connector names
      const connectorsRes = await fetch(`${PROXY}/api/${DEFAULT_CLUSTER}/connectors`);
      if (!connectorsRes.ok) {
        throw new Error('Failed to fetch connectors');
      }
      const connectorNames = await connectorsRes.json() as string[];

      // Get status for each connector
      const connectorStatuses = await Promise.all(
        connectorNames.map(async (name) => {
          const statusRes = await fetch(`${PROXY}/api/${DEFAULT_CLUSTER}/connectors/${encodeURIComponent(name)}/status`);
          if (!statusRes.ok) {
            throw new Error(`Failed to fetch status for ${name}`);
          }
          return statusRes.json() as Promise<ConnectorStatus>;
        })
      );

      setConnectors(connectorStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Connectors</h1>
          <SkeletonLine className="w-24 h-10" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Connectors</h1>
          <Link
            href="/connectors/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Create Connector
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            <h3 className="font-medium">Error loading connectors</h3>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={loadConnectors}
            className="mt-2 text-red-600 hover:text-red-500 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Connectors</h1>
        <Link
          href="/connectors/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Create Connector
        </Link>
      </div>

      {connectors.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <h3 className="text-lg font-medium">No connectors found</h3>
            <p className="text-sm">Get started by creating your first connector.</p>
          </div>
          <Link
            href="/connectors/new"
            className="mt-4 inline-flex bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Create Connector
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {connectors.map((connector) => (
            <Link
              key={connector.name}
              href={`/connectors/${encodeURIComponent(connector.name)}`}
              className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{connector.name}</h3>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <span>Type: {connector.type}</span>
                    <span>Tasks: {connector.tasks.length}</span>
                    <span>Worker: {connector.connector.worker_id}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStateColor(connector.connector.state)}`}>
                    {connector.connector.state}
                  </span>
                  <div className="text-xs text-gray-500">
                    {connector.tasks.length > 0 && (
                      <span>
                        {connector.tasks.filter(t => t.state === 'RUNNING').length}/{connector.tasks.length} tasks running
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}