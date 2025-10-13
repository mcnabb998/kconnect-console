'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const PROXY = 'http://localhost:8080';

interface Connector {
  name: string;
  type: string;
}

export default function Home() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cluster = 'default';

  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${PROXY}/api/${cluster}/connectors`);
      if (!response.ok) {
        throw new Error('Failed to fetch connectors');
      }
      const data = await response.json();
      
      // Kafka Connect returns an array of connector names
      const connectorList = Array.isArray(data) ? data.map((name: string) => ({
        name,
        type: 'Unknown' // We'll fetch details later
      })) : [];
      
      setConnectors(connectorList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Kafka Connect Console</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Connectors</h2>
            <div className="flex gap-2">
              <Link
                href="/connectors/new"
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                New Connector
              </Link>
              <button
                onClick={fetchConnectors}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Refresh
              </button>
            </div>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-600">Loading connectors...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && connectors.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <p>No connectors found. Start by creating a new connector.</p>
            </div>
          )}

          {!loading && !error && connectors.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {connectors.map((connector) => (
                  <li key={connector.name}>
                    <Link
                      href={`/connectors/${connector.name}`}
                      className="block hover:bg-gray-50 transition duration-150 ease-in-out"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-medium text-blue-600 truncate">
                            {connector.name}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
