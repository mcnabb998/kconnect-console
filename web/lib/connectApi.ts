import { ConnectorConfig, ConnectorGetResponse, PluginInfo, ValidateResponse } from '@/types/connect';

const BASE = process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8080';
const CLUSTER = 'default';

export async function getConnector(name: string): Promise<ConnectorGetResponse> {
  const r = await fetch(`${BASE}/api/${CLUSTER}/connectors/${name}`, { cache: 'no-store' });
  if (!r.ok) {
    throw new Error('Failed to load connector');
  }
  return r.json();
}

export async function putConnectorConfig(name: string, config: ConnectorConfig) {
  const r = await fetch(`${BASE}/api/${CLUSTER}/connectors/${name}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!r.ok) {
    throw new Error(await r.text());
  }
  return r.json();
}

export async function listPlugins(): Promise<PluginInfo[]> {
  const r = await fetch(`${BASE}/api/${CLUSTER}/connector-plugins`, { cache: 'no-store' });
  if (!r.ok) {
    throw new Error('Failed to list plugins');
  }
  return r.json();
}

export async function validateTransform(
  className: string,
  configs: Record<string, string>
): Promise<ValidateResponse> {
  const r = await fetch(
    `${BASE}/api/${CLUSTER}/connector-plugins/${encodeURIComponent(className)}/config/validate`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs }),
    }
  );
  if (!r.ok) {
    throw new Error(await r.text());
  }
  return r.json();
}
