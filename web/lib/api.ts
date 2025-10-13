// API utilities for Kafka Connect operations
// Use the browser's host for client-side requests
const PROXY = typeof window !== 'undefined' ? 'http://localhost:8080' : 'http://kconnect-proxy:8080';
const CLUSTER = 'default';

export interface ConnectorPlugin {
  class: string;
  type: 'source' | 'sink';
  version: string;
}

export interface ConfigDefinition {
  name: string;
  type: 'STRING' | 'PASSWORD' | 'INT' | 'LONG' | 'DOUBLE' | 'BOOLEAN' | 'LIST' | 'CLASS';
  required: boolean;
  default_value?: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  documentation: string;
  display_name?: string;
  width?: 'NONE' | 'SHORT' | 'MEDIUM' | 'LONG';
  dependents?: string[];
  order?: number;
  group?: string;
  recommended_values?: string[];
}

export interface ValidationResponse {
  name: string;
  error_count: number;
  groups: string[];
  configs: ConfigDefinition[];
  value?: {
    errors: Record<string, string[]>;
    recommended_values: Record<string, string[]>;
  };
}

export interface ConnectorConfig {
  name: string;
  config: Record<string, any>;
  tasks: Array<{ connector: string; task: number }>;
  type: string;
}

export interface ApiError {
  error_code?: number;
  message: string;
}

class KafkaConnectApiError extends Error {
  constructor(public status: number, public data: ApiError) {
    super(data.message);
    this.name = 'KafkaConnectApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${PROXY}/api/${CLUSTER}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new KafkaConnectApiError(response.status, errorData);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof KafkaConnectApiError) {
      throw error;
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function listPlugins(): Promise<ConnectorPlugin[]> {
  return apiRequest<ConnectorPlugin[]>('/connector-plugins');
}

export async function checkPluginAvailability(pluginClasses: string[]): Promise<Set<string>> {
  const plugins = await listPlugins();
  const availableClasses = new Set(plugins.map(p => p.class));
  return new Set(pluginClasses.filter(cls => availableClasses.has(cls)));
}

export async function validateConfig(
  pluginClass: string, 
  config: Record<string, any>
): Promise<ValidationResponse> {
  return apiRequest<ValidationResponse>(`/connector-plugins/${encodeURIComponent(pluginClass)}/config/validate`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function createConnector(
  name: string, 
  config: Record<string, any>
): Promise<ConnectorConfig> {
  const payload = {
    name,
    config: {
      ...config,
      name, // Ensure name is in config
    },
  };

  return apiRequest<ConnectorConfig>('/connectors', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getConnector(name: string): Promise<ConnectorConfig> {
  return apiRequest<ConnectorConfig>(`/connectors/${encodeURIComponent(name)}`);
}

export async function listConnectors(): Promise<string[]> {
  return apiRequest<string[]>('/connectors');
}

export { KafkaConnectApiError };