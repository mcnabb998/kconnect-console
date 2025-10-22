'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listPlugins,
  validateConfig,
  createConnector,
  ConnectorPlugin,
  ConfigDefinition,
  ValidationResponse,
  KafkaConnectApiError,
  extractValidationErrors,
} from '@/lib/api';
import DynamicField from '@/components/DynamicField';
import { logger } from '@/lib/logger';

type Step = 'plugin' | 'configure' | 'preview';

export default function NewConnectorPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('plugin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateNotice, setShowTemplateNotice] = useState(true);

  // Step 1: Plugin Selection
  const [plugins, setPlugins] = useState<ConnectorPlugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [connectorName, setConnectorName] = useState<string>('');
  const [pluginSearch, setPluginSearch] = useState<string>('');

  // Step 2: Configuration
  const [configDefinitions, setConfigDefinitions] = useState<ConfigDefinition[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [validating, setValidating] = useState(false);

  // Load plugins on mount
  useEffect(() => {
    const loadPlugins = async () => {
      try {
        setLoading(true);
        setError(null);
        const pluginList = await listPlugins();
        setPlugins(pluginList);

        // Try to restore from sessionStorage
        const savedPlugin = sessionStorage.getItem('lastSelectedPlugin');
        if (savedPlugin && pluginList.some(p => p.class === savedPlugin)) {
          setSelectedPlugin(savedPlugin);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    };

    loadPlugins();
  }, []);

  // Filter plugins based on search
  const filteredPlugins = useMemo(() => {
    if (!pluginSearch) return plugins;
    const search = pluginSearch.toLowerCase();
    return plugins.filter(plugin => {
      // Add safety checks to prevent undefined errors
      const pluginClass = plugin?.class || '';
      const pluginType = plugin?.type || '';
      return pluginClass.toLowerCase().includes(search) ||
             pluginType.toLowerCase().includes(search);
    });
  }, [plugins, pluginSearch]);

  // Debounced validation
  useEffect(() => {
    if (!selectedPlugin || currentStep !== 'configure') return;

    const validateDebounced = async () => {
      if (Object.keys(configValues).length === 0) return;

      try {
        setValidating(true);
        const response = await validateConfig(selectedPlugin, {
          'connector.class': selectedPlugin,
          ...configValues,
        });

        // Extract the definitions from the validation response structure
        const definitions = response.configs?.map(config => config.definition) || [];
        setConfigDefinitions(definitions);
        
        setValidationErrors(extractValidationErrors(response));
      } catch (err) {
        console.error('Validation error:', err);
        setValidationErrors({});
      } finally {
        setValidating(false);
      }
    };

    const timeoutId = setTimeout(validateDebounced, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedPlugin, configValues, currentStep]);

  // Initial validation when plugin selected
  useEffect(() => {
    if (!selectedPlugin || currentStep !== 'configure') return;

    const initialValidation = async () => {
      try {
        setLoading(true);
        setError(null);
        
        logger.debug('Starting validation for plugin:', selectedPlugin);
        
        // Start with common defaults
        const initialConfig = {
          'connector.class': selectedPlugin,
          'tasks.max': '1',
        };

        const response = await validateConfig(selectedPlugin, initialConfig);
        logger.debug('Validation response:', response);
        
        // Extract the definitions from the validation response structure
        const definitions = response.configs?.map(config => config.definition) || [];
        setConfigDefinitions(definitions);
        setConfigValues(initialConfig);
        
        setValidationErrors(extractValidationErrors(response));
      } catch (err) {
        logger.error('Validation error:', err);
        if (err instanceof Error) {
          setError(`Failed to load configuration: ${err.message}`);
        } else {
          setError('Failed to load configuration');
        }
      } finally {
        setLoading(false);
      }
    };

    initialValidation();
  }, [selectedPlugin, currentStep]);

  const handlePluginSelect = (pluginClass: string) => {
    setSelectedPlugin(pluginClass);
    sessionStorage.setItem('lastSelectedPlugin', pluginClass);
  };

  const handleConfigChange = (fieldName: string, value: any) => {
    setConfigValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const canProceedFromPlugin = () => {
    return selectedPlugin && connectorName.trim();
  };

  const canProceedFromConfigure = () => {
    // Check if all required fields have values or defaults
    const missingRequired = configDefinitions.filter(def => {
      if (!def.required) return false;
      const value = configValues[def.name];
      return !value && !def.default_value;
    });

    // Check if there are any validation errors
    const hasErrors = Object.keys(validationErrors).length > 0;

    return missingRequired.length === 0 && !hasErrors;
  };

  const handleNext = () => {
    if (currentStep === 'plugin' && canProceedFromPlugin()) {
      setCurrentStep('configure');
    } else if (currentStep === 'configure' && canProceedFromConfigure()) {
      setCurrentStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'configure') {
      setCurrentStep('plugin');
    } else if (currentStep === 'preview') {
      setCurrentStep('configure');
    }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);

      const finalConfig = {
        'connector.class': selectedPlugin,
        name: connectorName,
        ...configValues,
      };

      await createConnector(connectorName, finalConfig);
      
      // Show success message and redirect
      router.push(`/connectors/${encodeURIComponent(connectorName)}?created=true`);
    } catch (err) {
      if (err instanceof KafkaConnectApiError) {
        setError(`Failed to create connector: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create connector');
      }
    } finally {
      setLoading(false);
    }
  };

  const getFinalConfig = () => {
    return {
      name: connectorName,
      config: {
        'connector.class': selectedPlugin,
        name: connectorName,
        ...configValues,
      },
    };
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'plugin': return 1;
      case 'configure': return 2;
      case 'preview': return 3;
      default: return 1;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'plugin': return 'Select Plugin';
      case 'configure': return 'Configure';
      case 'preview': return 'Preview & Deploy';
      default: return 'Select Plugin';
    }
  };

  if (loading && plugins.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto py-6 px-4">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading connector plugins...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Template Notice */}
      {showTemplateNotice && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="max-w-4xl mx-auto flex items-start">
            <div className="text-blue-400 mr-3">ℹ️</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">New Template-Based Connector Creation Available!</h3>
              <p className="text-sm text-blue-700 mt-1">
                We now offer pre-configured connector templates that automatically check plugin availability and guide you through setup.
              </p>
              <div className="mt-3 flex items-center space-x-3">
                <Link
                  href="/connectors/templates"
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Try Template-Based Creation
                </Link>
                <button
                  onClick={() => setShowTemplateNotice(false)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Continue with Advanced Mode
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowTemplateNotice(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back to Connectors
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">New Connector</h1>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {getStepNumber()} of 3: {getStepTitle()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Step 1: Plugin Selection */}
        {currentStep === 'plugin' && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Connector Plugin</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Select a connector plugin and give your connector a unique name
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Connector Name *
              </label>
              <input
                type="text"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                placeholder="my-awesome-connector"
                className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Must be unique across all connectors in this cluster
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Search Plugins
              </label>
              <input
                type="text"
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                placeholder="Search by name or type..."
                className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              />
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
              {filteredPlugins.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">No plugins found matching your search</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                filteredPlugins.map((plugin) => (
                  <div
                    key={plugin.class}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedPlugin === plugin.class
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800 hover:shadow-sm'
                    }`}
                    onClick={() => handlePluginSelect(plugin.class)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{plugin.class}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Version: {plugin.version}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        plugin.type === 'source' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                      }`}>
                        {plugin.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleNext}
                disabled={!canProceedFromPlugin()}
                className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Configure →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {currentStep === 'configure' && (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Configure Connector</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure your <span className="font-mono text-blue-600 dark:text-blue-400">{selectedPlugin}</span> connector
                </p>
              </div>
              {validating && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Validating...
                </div>
              )}
            </div>

            {configDefinitions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">Loading configuration options...</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">This may take a moment</p>
              </div>
            ) : (
              <div>
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📋 Configuration Guide</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Fields marked with <span className="text-red-500 font-bold">*</span> are required. 
                    Fields are sorted by importance - configure <span className="font-semibold">HIGH</span> priority items first.
                  </p>
                </div>
                
                <div className="space-y-6">
                  {configDefinitions
                    .filter(def => def.name !== 'connector.class' && def.name !== 'name')
                    .sort((a, b) => {
                      // Sort by importance, then by required status
                      const importanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                      const aOrder = importanceOrder[a.importance] + (a.required ? 0 : 10);
                      const bOrder = importanceOrder[b.importance] + (b.required ? 0 : 10);
                      return aOrder - bOrder;
                    })
                    .map((definition) => (
                      <DynamicField
                        key={definition.name}
                        definition={definition}
                        value={configValues[definition.name]}
                        onChange={(value) => handleConfigChange(definition.name, value)}
                        error={validationErrors[definition.name]}
                      />
                    ))}
                </div>
                
                {configDefinitions.length > 0 && (
                  <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      💡 <strong>Tip:</strong> Configuration will be validated automatically. 
                      Fill out required fields to proceed to the preview step.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button
                onClick={handleBack}
                className="flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceedFromConfigure() || validating}
                className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Deploy */}
        {currentStep === 'preview' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Preview & Deploy</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Connector Configuration</h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm">
                  {JSON.stringify(getFinalConfig(), null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Connector'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}