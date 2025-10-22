'use client';

import { useState, useEffect } from 'react';
import { fetchClusterInfo, fetchConnectorPlugins, fetchSummary } from '@/lib/api';
import Cards from '@/components/settings/Cards';
import PluginsTable from '@/components/settings/PluginsTable';

interface ClusterInfo {
  version: string;
  commit: string;
  kafka_cluster_id: string;
}

interface ConnectorPlugin {
  class: string;
  type: string;
  version: string;
}

interface Summary {
  clusterInfo: ClusterInfo;
  connectorPlugins: ConnectorPlugin[];
  connectorStats: {
    total: number;
    running: number;
    failed: number;
    paused: number;
  };
  workerInfo: {
    [key: string]: any;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'plugins'>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [plugins, setPlugins] = useState<ConnectorPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === 'overview') {
          const summaryData = await fetchSummary('default');
          setSummary(summaryData);
        } else if (activeTab === 'plugins') {
          const pluginsData = await fetchConnectorPlugins('default');
          setPlugins(pluginsData);
        }
      } catch (err) {
        console.error('Failed to load settings data:', err);
        setError(err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="flex space-x-4 mb-6">
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if this is a proxy connectivity error
    const isProxyError = error.includes('Failed to fetch') ||
                        error.includes('Network error') ||
                        error.includes('fetch failed') ||
                        error.includes('ECONNREFUSED');

    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold text-lg mb-3">
            {isProxyError ? 'Cannot Connect to Proxy Service' : 'Error Loading Settings'}
          </h2>
          <p className="text-red-700 mb-4">{error}</p>

          {isProxyError && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-red-900 font-medium">The proxy service is not running or not accessible.</p>
              <div className="bg-white rounded p-4 border border-red-200">
                <p className="font-semibold text-gray-900 mb-2">To start the proxy service:</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-gray-700 mb-1"><strong>Option 1:</strong> Using Docker Compose</p>
                    <code className="block bg-gray-900 text-gray-100 px-3 py-2 rounded font-mono text-xs">
                      cd compose && docker compose up -d
                    </code>
                  </div>
                  <div>
                    <p className="text-gray-700 mb-1"><strong>Option 2:</strong> Using Makefile</p>
                    <code className="block bg-gray-900 text-gray-100 px-3 py-2 rounded font-mono text-xs">
                      make up
                    </code>
                  </div>
                </div>
                <p className="text-gray-600 mt-3 text-xs">
                  The proxy service should be accessible at: <strong className="text-gray-900">http://localhost:8080</strong>
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plugins'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Plugins
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && summary && (
        <Cards summary={summary} />
      )}

      {activeTab === 'plugins' && (
        <PluginsTable plugins={plugins} />
      )}
    </div>
  );
}