'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const PROXY = 'http://localhost:8080';

interface Connector {
  name: string;
}

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';
const CLUSTER_ID = process.env.NEXT_PUBLIC_CLUSTER_ID ?? 'default';

export default function Home() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connectorsEndpoint = `${PROXY_URL}/api/${CLUSTER_ID}/connectors`;

  const fetchConnectors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(connectorsEndpoint, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch connectors');
      }
      const data = await response.json();
      const connectorList = Array.isArray(data)
        ? data.map((name: string) => ({ name }))
        : [];
      setConnectors(connectorList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [connectorsEndpoint]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Connectors</h1>
          <p className="text-sm text-gray-600">Cluster: {CLUSTER_ID}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/connectors/templates"
            className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
          >
            Create Connector
          </Link>
          <Link
            href="/capabilities"
            className="inline-flex items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
          >
            View Capabilities
          </Link>
          <button
            onClick={fetchConnectors}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <div
            className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading connectors…</p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-700">Error</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && connectors.length === 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
            No connectors found. Start by creating a new connector using our template-based wizard.
          </div>
          
          {/* Quick Start Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">🚀 Create Connector</h3>
              <p className="text-sm text-gray-600 mb-4">
                Use our template-based wizard with pre-configured connector templates. 
                Automatically detects which plugins are installed and available.
              </p>
              <Link
                href="/connectors/templates"
                className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Get Started
              </Link>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">🔍 View Capabilities</h3>
              <p className="text-sm text-gray-600 mb-4">
                Explore all installed connector plugins, their configuration options, 
                and see which templates are available.
              </p>
              <Link
                href="/capabilities"
                className="text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Explore Plugins
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && connectors.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-200">
            {connectors.map((connector) => (
              <li key={connector.name}>
                <Link
                  href={`/connectors/${encodeURIComponent(connector.name)}`}
                  className="block px-4 py-4 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:px-6"
                >
                  <p className="text-lg font-medium text-blue-600">{connector.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
