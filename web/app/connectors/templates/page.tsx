'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listPlugins,
  validateConfig,
  createConnector,
  checkPluginAvailability,
  ConnectorPlugin,
  ConfigDefinition,
  ValidationResponse,
  KafkaConnectApiError,
} from '@/lib/api';
import { connectorTemplates, ConnectorTemplate, getTemplatesByCategory } from '@/data/connectorTemplates';
import DynamicField from '@/components/DynamicField';

type Step = 'template' | 'plugin' | 'configure' | 'preview';

interface PluginAvailability {
  available: Set<string>;
  loading: boolean;
  lastRefresh: Date | null;
}

export default function NewConnectorPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('template');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plugin availability tracking
  const [pluginAvailability, setPluginAvailability] = useState<PluginAvailability>({
    available: new Set(),
    loading: false,
    lastRefresh: null,
  });

  // Template Selection
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectorTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Plugin Selection (for custom connectors)
  const [plugins, setPlugins] = useState<ConnectorPlugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [connectorName, setConnectorName] = useState<string>('');
  const [pluginSearch, setPluginSearch] = useState<string>('');

  // Configuration
  const [configDefinitions, setConfigDefinitions] = useState<ConfigDefinition[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [validating, setValidating] = useState(false);

  // Load plugin availability on mount
  useEffect(() => {
    refreshPluginAvailability();
  }, []);

  const refreshPluginAvailability = async () => {
    try {
      setPluginAvailability(prev => ({ ...prev, loading: true }));
      setError(null);

      const [pluginList, availableClasses] = await Promise.all([
        listPlugins(),
        checkPluginAvailability(connectorTemplates.map(t => t.connectorClass)),
      ]);

      setPlugins(pluginList);
      setPluginAvailability({
        available: availableClasses,
        loading: false,
        lastRefresh: new Date(),
      });
    } catch (error) {
      const message = error instanceof KafkaConnectApiError
        ? `API Error: ${error.message}`
        : `Failed to load connector plugins: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(message);
      setPluginAvailability(prev => ({ ...prev, loading: false }));
    }
  };

  // Enhanced connector templates with availability info
  const enhancedTemplates = useMemo(() => {
    return connectorTemplates.map(template => ({
      ...template,
      available: pluginAvailability.available.has(template.connectorClass),
    }));
  }, [pluginAvailability.available]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = enhancedTemplates;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (templateSearch) {
      const search = templateSearch.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(search) || 
        t.description.toLowerCase().includes(search)
      );
    }

    // Sort by availability (available first), then by name
    return filtered.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [enhancedTemplates, selectedCategory, templateSearch]);

  // Filter plugins for custom selection
  const filteredPlugins = useMemo(() => {
    if (!pluginSearch) return plugins;
    const search = pluginSearch.toLowerCase();
    return plugins.filter(p => 
      p.class.toLowerCase().includes(search) ||
      p.type.toLowerCase().includes(search)
    );
  }, [plugins, pluginSearch]);

  // Handle template selection
  const handleTemplateSelect = (template: ConnectorTemplate) => {
    if (!template.available) return;
    
    setSelectedTemplate(template);
    setSelectedPlugin(template.connectorClass);
    const defaultConfig = { 'connector.class': template.connectorClass, ...template.defaultConfig };
    setConfigValues(defaultConfig);
    setCurrentStep('configure');
    loadConfigDefinitions(template.connectorClass, defaultConfig);
  };

  // Load configuration definitions for a plugin
  const loadConfigDefinitions = async (
    pluginClass: string,
    initialConfig: Record<string, any> = {}
  ) => {
    try {
      setLoading(true);
      setError(null);
      const validation = await validateConfig(pluginClass, {
        'connector.class': pluginClass,
        ...initialConfig,
      });
      setConfigDefinitions(validation.configs || []);
    } catch (error) {
      const message = error instanceof KafkaConnectApiError
        ? `Validation Error: ${error.message}`
        : `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Validate configuration
  const validateConfiguration = async () => {
    if (!selectedPlugin) return;

    try {
      setValidating(true);
      setValidationErrors({});
      const validation = await validateConfig(selectedPlugin, configValues);
      if (validation.value?.errors) {
        setValidationErrors(validation.value.errors);
        return false;
      }
      return true;
    } catch (error) {
      const message = error instanceof KafkaConnectApiError
        ? error.message
        : `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(message);
      return false;
    } finally {
      setValidating(false);
    }
  };

  // Create connector
  const handleCreate = async () => {
    if (!connectorName.trim() || !selectedPlugin) return;

    const isValid = await validateConfiguration();
    if (!isValid) return;

    try {
      setLoading(true);
      setError(null);
      await createConnector(connectorName, configValues);
      router.push(`/connectors/${encodeURIComponent(connectorName)}`);
    } catch (error) {
      const message = error instanceof KafkaConnectApiError
        ? `Creation Failed: ${error.message}`
        : `Failed to create connector: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'database', 'messaging', 'storage', 'analytics', 'other'];
  const availableCount = enhancedTemplates.filter(t => t.available).length;
  const totalCount = enhancedTemplates.length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Connector</h1>
          <p className="text-sm text-gray-600 mt-1">
            {availableCount} of {totalCount} connector types available
            {pluginAvailability.lastRefresh && (
              <span className="ml-2 text-xs">
                (refreshed {pluginAvailability.lastRefresh.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshPluginAvailability}
            disabled={pluginAvailability.loading}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <span className={pluginAvailability.loading ? 'animate-spin' : ''}>🔄</span>
            <span>Refresh Plugins</span>
          </button>
          <Link
            href="/capabilities"
            className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            View Capabilities
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

      {/* Step Indicator */}
      <div className="flex items-center space-x-4">
        {['template', 'configure', 'preview'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === step
                ? 'bg-blue-600 text-white'
                : index < ['template', 'configure', 'preview'].indexOf(currentStep)
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            <span className="ml-2 text-sm font-medium text-gray-700 capitalize">
              {step}
            </span>
            {index < 2 && <div className="w-12 h-px bg-gray-300 ml-4" />}
          </div>
        ))}
      </div>

      {/* Template Selection Step */}
      {currentStep === 'template' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Choose a Connector Template</h2>
            
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    template.available
                      ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{template.icon}</span>
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        template.available
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {template.available ? '🟢 Available' : '🔴 Missing plugin'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        template.type === 'source'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {template.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  {!template.available && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      💡 Install this connector JAR on the Kafka Connect worker to enable deployment
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Custom Connector Option */}
            <div className="mt-8 p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Custom Connector</h3>
              <p className="text-sm text-gray-600 mb-4">
                Don't see what you need? Configure a connector manually from installed plugins.
              </p>
              <button
                onClick={() => setCurrentStep('plugin')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Browse All Plugins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Selection Step (for custom connectors) */}
      {currentStep === 'plugin' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Choose a Plugin</h2>
            <button
              onClick={() => setCurrentStep('template')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Templates
            </button>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Search plugins by class name or type..."
              value={pluginSearch}
              onChange={(e) => setPluginSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="grid gap-3">
              {filteredPlugins.map(plugin => (
                <div
                  key={plugin.class}
                  onClick={() => {
                    setSelectedPlugin(plugin.class);
                    const defaultConfig = { 'connector.class': plugin.class, 'tasks.max': '1' };
                    setConfigValues(defaultConfig);
                    setCurrentStep('configure');
                    loadConfigDefinitions(plugin.class, defaultConfig);
                  }}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{plugin.class}</h3>
                      <p className="text-sm text-gray-600">Version: {plugin.version}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      plugin.type === 'source'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {plugin.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Step */}
      {currentStep === 'configure' && selectedPlugin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Configure Connector</h2>
            <button
              onClick={() => setCurrentStep(selectedTemplate ? 'template' : 'plugin')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back
            </button>
          </div>

          {selectedTemplate && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{selectedTemplate.icon}</span>
                <div>
                  <h3 className="font-medium text-blue-900">{selectedTemplate.name}</h3>
                  <p className="text-sm text-blue-700">{selectedTemplate.description}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connector Name *
              </label>
              <input
                type="text"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="my-connector"
                required
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading configuration schema...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {configDefinitions
                  .filter(def => !['name', 'connector.class'].includes(def.name))
                  .sort((a, b) => {
                    if (a.importance !== b.importance) {
                      const importanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                      return importanceOrder[a.importance] - importanceOrder[b.importance];
                    }
                    return (a.order || 999) - (b.order || 999);
                  })
                  .map((definition, index) => (
                    <DynamicField
                      key={`${definition.name}-${index}`}
                      definition={definition}
                      value={configValues[definition.name]}
                      onChange={(value) => setConfigValues(prev => ({ ...prev, [definition.name]: value }))}
                      error={validationErrors[definition.name]}
                    />
                  ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                onClick={validateConfiguration}
                disabled={validating}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {validating ? 'Validating...' : 'Validate Configuration'}
              </button>
              <button
                onClick={() => setCurrentStep('preview')}
                disabled={!connectorName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Review Connector</h2>
            <button
              onClick={() => setCurrentStep('configure')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Configuration
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Connector Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 font-medium">{connectorName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Class:</span>
                  <span className="ml-2 font-mono text-xs">{selectedPlugin}</span>
                </div>
                {selectedTemplate && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Template:</span>
                    <span className="ml-2 font-medium">{selectedTemplate.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Configuration</h3>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-60">
                {JSON.stringify(configValues, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Ready to create connector "{connectorName}"
              </div>
              <button
                onClick={handleCreate}
                disabled={loading || !connectorName.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Connector'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}