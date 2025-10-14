// API utilities for Kafka Connect operations
// Use the browser's host for client-side requests
const PROXY = typeof window !== 'undefined' ? 'http://localhost:8080' : 'http://kconnect-proxy:8080';
const CLUSTER = 'default';

export type ConnectorAction = 'pause' | 'resume' | 'restart' | 'delete';

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
  configs: Array<{
    definition: ConfigDefinition;
    value: {
      errors: string;
      name: string;
      recommended_values: string;
      value: any;
      visible: boolean;
    };
  }>;
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

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();

    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
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

export interface BulkConnectorActionFailure {
  name: string;
  error: string;
}

export interface BulkConnectorActionResult {
  successes: string[];
  failures: BulkConnectorActionFailure[];
}

function resolveConnectorActionMethod(action: ConnectorAction): 'DELETE' | 'POST' | 'PUT' {
  if (action === 'restart') {
    return 'POST';
  }

  if (action === 'delete') {
    return 'DELETE';
  }

  return 'PUT';
}

export async function performConnectorAction(name: string, action: ConnectorAction): Promise<void> {
  await apiRequest<void>(`/connectors/${encodeURIComponent(name)}/${action}`, {
    method: resolveConnectorActionMethod(action),
  });
}

export async function bulkConnectorAction(
  names: string[],
  action: ConnectorAction
): Promise<BulkConnectorActionResult> {
  const outcomes = await Promise.allSettled(
    names.map(async (name) => {
      await performConnectorAction(name, action);
      return name;
    })
  );

  const successes: string[] = [];
  const failures: BulkConnectorActionFailure[] = [];

  outcomes.forEach((result, index) => {
    const connectorName = names[index];

    if (result.status === 'fulfilled') {
      successes.push(connectorName);
      return;
    }

    const reason = result.reason;
    let message = 'Unknown error';

    if (reason instanceof KafkaConnectApiError) {
      message = reason.data?.message ?? `HTTP ${reason.status}`;
    } else if (reason instanceof Error) {
      message = reason.message;
    } else if (typeof reason === 'string') {
      message = reason;
    }

    failures.push({ name: connectorName, error: message });
  });

  return { successes, failures };
}

export { KafkaConnectApiError };

// Settings page API functions
export async function fetchClusterInfo(cluster: string = CLUSTER): Promise<any> {
  return apiRequest<any>(`/cluster`);
}

export async function fetchConnectorPlugins(cluster: string = CLUSTER): Promise<ConnectorPlugin[]> {
  return listPlugins();
}

export async function fetchSummary(cluster: string = CLUSTER): Promise<any> {
  return apiRequest<any>(`/summary`);
}
