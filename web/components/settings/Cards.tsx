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
  connectorPlugins?: ConnectorPlugin[];
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

interface CardsProps {
  summary: Summary;
}

export default function Cards({ summary }: CardsProps) {
  const { clusterInfo, connectorStats, connectorPlugins = [], workerInfo } = summary;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Connectors</div>
              <div className="text-2xl font-bold text-gray-900">{connectorStats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Running</div>
              <div className="text-2xl font-bold text-green-600">{connectorStats.running}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Failed</div>
              <div className="text-2xl font-bold text-red-600">{connectorStats.failed}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Paused</div>
              <div className="text-2xl font-bold text-yellow-600">{connectorStats.paused}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cluster Info */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cluster Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Version</dt>
                <dd className="text-sm text-gray-900">{clusterInfo.version}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Commit</dt>
                <dd className="text-sm text-gray-900 font-mono">{clusterInfo.commit.substring(0, 8)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Kafka Cluster ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{clusterInfo.kafka_cluster_id}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Plugin Summary */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Available Plugins</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Plugins</dt>
                <dd className="text-sm text-gray-900">{connectorPlugins?.length ?? 0}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Source Connectors</dt>
                <dd className="text-sm text-gray-900">
                  {connectorPlugins?.filter(p => p.type === 'source').length ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Sink Connectors</dt>
                <dd className="text-sm text-gray-900">
                  {connectorPlugins?.filter(p => p.type === 'sink').length ?? 0}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Worker Info */}
        {workerInfo && Object.keys(workerInfo).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 lg:col-span-2">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Worker Information</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(workerInfo).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-gray-500 capitalize">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}