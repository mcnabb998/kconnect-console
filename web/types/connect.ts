export type ConnectorConfig = Record<string, string>;
export type ConnectorGetResponse = { name: string; config: ConnectorConfig };
export type PluginInfo = { class: string; type?: string; version?: string; title?: string };
export type ValidateRequest = { configs: Record<string, string> };
export type ValidateResponse = { error_count: number; configs: Array<any>; name?: string };
export type SMTItem = { alias: string; className: string; params: Record<string, string> };

// Connector Metrics Types
export interface ThroughputMetrics {
  recordsPerSecond: number;
  bytesPerSecond: number;
  totalRecords: number;
  totalBytes: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  lastErrorTime?: number;
  recentErrorCount: number;
}

export interface ResourceMetrics {
  cpuPercent?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  threadCount?: number;
}

export interface LagMetrics {
  totalLag: number;
  maxLag: number;
  averageLag: number;
  partitionLag?: Record<string, number>;
}

export interface TaskMetrics {
  taskId: number;
  recordsProcessed: number;
  bytesProcessed: number;
  errorCount: number;
  state: string;
}

export interface ConnectorMetrics {
  connectorName: string;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
  resources: ResourceMetrics;
  lag?: LagMetrics;
  tasks: TaskMetrics[];
  lastUpdated: string;
  collectionDuration: number;
}

// Historical metrics for charting
export interface MetricsSnapshot {
  timestamp: number;
  recordsPerSecond: number;
  bytesPerSecond: number;
  errorRate: number;
  totalRecords: number;
  totalErrors: number;
}
