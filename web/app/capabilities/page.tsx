'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listPlugins,
  validateConfig,
  ConnectorPlugin,
  ConfigDefinition,
  KafkaConnectApiError,
} from '@/lib/api';
import { connectorTemplates, getTemplateById } from '@/data/connectorTemplates';

interface PluginCapability {
  plugin: ConnectorPlugin;
  configDefinitions?: ConfigDefinition[];
  template?: any;
  loading: boolean;
  error?: string;
}

export default function CapabilitiesPage() {
  const [plugins, setPlugins] = useState<ConnectorPlugin[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, PluginCapability>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'source' | 'sink'>('all');
  const [showOnlyWithTemplates, setShowOnlyWithTemplates] = useState(false);
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pluginList = await listPlugins();
      setPlugins(pluginList);

      // Initialize capabilities state
      const initialCapabilities: Record<string, PluginCapability> = {};
      pluginList.forEach(plugin => {
        const template = connectorTemplates.find(t => t.connectorClass === plugin.class);
        initialCapabilities[plugin.class] = {
          plugin,
          template,
          loading: false,
        };
      });
      setCapabilities(initialCapabilities);

    } catch (err) {
      const message = err instanceof KafkaConnectApiError
        ? `API Error: ${err.message}`
        : `Failed to load capabilities: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPluginConfig = async (pluginClass: string) => {
    if (capabilities[pluginClass]?.configDefinitions) {
      return; // Already loaded
    }

    setCapabilities(prev => ({
      ...prev,
      [pluginClass]: {
        ...prev[pluginClass],
        loading: true,
      }
    }));

    try {
      const validation = await validateConfig(pluginClass, {
        'connector.class': pluginClass,
      });
      // Extract the definitions from the validation response structure
      const definitions = validation.configs?.map(config => config.definition) || [];
      setCapabilities(prev => ({
        ...prev,
        [pluginClass]: {
          ...prev[pluginClass],
          configDefinitions: definitions,
          loading: false,
        }
      }));
    } catch (err) {
      const message = err instanceof KafkaConnectApiError
        ? err.message
        : `Failed to load config: ${err instanceof Error ? err.message : 'Unknown error'}`;
      
      setCapabilities(prev => ({
        ...prev,
        [pluginClass]: {
          ...prev[pluginClass],
          error: message,
          loading: false,
        }
      }));
    }
  };

  const toggleExpanded = (pluginClass: string) => {
    const newExpanded = new Set(expandedPlugins);
    if (expandedPlugins.has(pluginClass)) {
      newExpanded.delete(pluginClass);
    } else {
      newExpanded.add(pluginClass);
      loadPluginConfig(pluginClass);
    }
    setExpandedPlugins(newExpanded);
  };

  const filteredPlugins = plugins.filter(plugin => {
    const capability = capabilities[plugin.class];
    
    // Filter by type
    if (filterType !== 'all' && plugin.type !== filterType) {
      return false;
    }
    
    // Filter by template availability
    if (showOnlyWithTemplates && !capability?.template) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        plugin.class.toLowerCase().includes(search) ||
        capability?.template?.name?.toLowerCase().includes(search) ||
        capability?.template?.description?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const pluginStats = {
    total: plugins.length,
    sources: plugins.filter(p => p.type === 'source').length,
    sinks: plugins.filter(p => p.type === 'sink').length,
    withTemplates: plugins.filter(p => capabilities[p.class]?.template).length,
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading connector capabilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connector Capabilities</h1>
          <p className="text-sm text-gray-600 mt-1">
            Installed connector plugins and their configuration options
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadCapabilities}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
          <Link
            href="/connectors/templates"
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Create Connector
          </Link>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-red-400">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{pluginStats.total}</div>
          <div className="text-sm text-gray-600">Total Plugins</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{pluginStats.sources}</div>
          <div className="text-sm text-gray-600">Source Connectors</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">{pluginStats.sinks}</div>
          <div className="text-sm text-gray-600">Sink Connectors</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{pluginStats.withTemplates}</div>
          <div className="text-sm text-gray-600">With Templates</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by plugin class, template name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="source">Source Only</option>
            <option value="sink">Sink Only</option>
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyWithTemplates}
              onChange={(e) => setShowOnlyWithTemplates(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Only show plugins with templates</span>
          </label>
        </div>
      </div>

      {/* Plugin List */}
      <div className="space-y-4">
        {filteredPlugins.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No plugins match your current filters.
          </div>
        ) : (
          filteredPlugins.map(plugin => {
            const capability = capabilities[plugin.class];
            const isExpanded = expandedPlugins.has(plugin.class);
            
            return (
              <div key={plugin.class} className="bg-white border border-gray-200 rounded-lg">
                <div
                  onClick={() => toggleExpanded(plugin.class)}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        {capability?.template?.icon && (
                          <span className="text-2xl">{capability.template.icon}</span>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {capability?.template?.name || plugin.class}
                          </h3>
                          <p className="text-sm text-gray-600 font-mono">{plugin.class}</p>
                          {capability?.template?.description && (
                            <p className="text-sm text-gray-600 mt-1">{capability.template.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        plugin.type === 'source'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {plugin.type}
                      </span>
                      {capability?.template && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Template Available
                        </span>
                      )}
                      <span className="text-xs text-gray-500">v{plugin.version}</span>
                      <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 space-y-4">
                    {capability?.template && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <h4 className="font-medium text-green-900 mb-2">Available Template</h4>
                        <div className="text-sm text-green-800 space-y-1">
                          <p><strong>Category:</strong> {capability.template.category}</p>
                          <p><strong>Required Fields:</strong> {capability.template.requiredFields.join(', ')}</p>
                          {capability.template.documentation && (
                            <p>
                              <strong>Documentation:</strong>{' '}
                              <a 
                                href={capability.template.documentation}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                View Docs
                              </a>
                            </p>
                          )}
                        </div>
                        <div className="mt-3">
                          <Link
                            href="/connectors/templates"
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            Use Template
                          </Link>
                        </div>
                      </div>
                    )}

                    {capability?.loading && (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading configuration schema...</span>
                      </div>
                    )}

                    {capability?.error && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-700">Error loading configuration: {capability.error}</p>
                      </div>
                    )}

                    {capability?.configDefinitions && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Configuration Options</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {capability.configDefinitions
                            .sort((a, b) => {
                              const importanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                              if (a.importance !== b.importance) {
                                return importanceOrder[a.importance] - importanceOrder[b.importance];
                              }
                              return (a.order || 999) - (b.order || 999);
                            })
                            .map(config => (
                              <div key={config.name} className="border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <h5 className="font-medium text-sm">{config.display_name || config.name}</h5>
                                  <div className="flex items-center space-x-2">
                                    {config.required && (
                                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                        Required
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      config.importance === 'HIGH'
                                        ? 'bg-red-100 text-red-800'
                                        : config.importance === 'MEDIUM'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {config.importance}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{config.documentation}</p>
                                <div className="text-xs text-gray-500 space-y-1">
                                  <div><strong>Type:</strong> {config.type}</div>
                                  {config.default_value && (
                                    <div><strong>Default:</strong> {config.default_value}</div>
                                  )}
                                  {config.recommended_values && config.recommended_values.length > 0 && (
                                    <div><strong>Options:</strong> {config.recommended_values.join(', ')}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}