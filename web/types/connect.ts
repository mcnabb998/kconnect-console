export type ConnectorConfig = Record<string, string>;
export type ConnectorGetResponse = { name: string; config: ConnectorConfig };
export type PluginInfo = { class: string; type?: string; version?: string; title?: string };
export type ValidateRequest = { configs: Record<string, string> };
export type ValidateResponse = { error_count: number; configs: Array<any>; name?: string };
export type SMTItem = { alias: string; className: string; params: Record<string, string> };
