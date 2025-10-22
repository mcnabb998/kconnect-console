'use client';

import { useState, useEffect } from 'react';
import { fetchClusterInfo, fetchConnectorPlugins, fetchSummary } from '@/lib/api';
import Cards from '@/components/settings/Cards';
import PluginsTable from '@/components/settings/PluginsTable';
import { ErrorDisplay } from '@/components/ErrorDisplay';

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
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
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
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <ErrorDisplay
          error={error}
          onRetry={loadData}
          context={`Loading settings (${activeTab} tab)`}
        />
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