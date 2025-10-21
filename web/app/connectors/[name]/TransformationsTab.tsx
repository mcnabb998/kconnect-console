'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getConnector, listPlugins, putConnectorConfig, validateTransform } from '@/lib/connectApi';
import type {
  ConnectorConfig,
  ConnectorGetResponse,
  PluginInfo,
  SMTItem,
  ValidateResponse,
} from '@/types/connect';
import { LoadingButton } from '@/components/LoadingButton';
import TransformEditor from '@/components/smts/TransformEditor';
import TransformList from '@/components/smts/TransformList';
import PreviewPanel from '@/components/smts/PreviewPanel';

export type ValidationState = {
  response: ValidateResponse | null;
  error?: string | null;
  fingerprint?: string;
};

const secretPattern = /(password|secret|token|key)$/i;

export function parseFromConnectorConfig(config: ConnectorConfig): SMTItem[] {
  const aliases = config.transforms
    ? config.transforms
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean)
    : [];

  const items: SMTItem[] = [];

  aliases.forEach((alias) => {
    const typeKey = `transforms.${alias}.type`;
    const className = config[typeKey];
    if (!className) {
      return;
    }

    const params: Record<string, string> = {};
    const prefix = `transforms.${alias}.`;
    Object.entries(config).forEach(([key, value]) => {
      if (key.startsWith(prefix) && key !== typeKey) {
        const paramKey = key.substring(prefix.length);
        params[paramKey] = value;
      }
    });

    items.push({ alias, className, params });
  });

  return items;
}

export function applyToConnectorConfig(
  baseConfig: ConnectorConfig,
  smts: SMTItem[]
): ConnectorConfig {
  const cleaned: ConnectorConfig = {};
  Object.entries(baseConfig).forEach(([key, value]) => {
    if (!key.startsWith('transforms.')) {
      cleaned[key] = value;
    }
  });

  if (smts.length === 0) {
    delete cleaned.transforms;
    return cleaned;
  }

  cleaned.transforms = smts.map((item) => item.alias).join(',');

  smts.forEach((item) => {
    const prefix = `transforms.${item.alias}`;
    cleaned[`${prefix}.type`] = item.className;
    Object.entries(item.params).forEach(([key, value]) => {
      cleaned[`${prefix}.${key}`] = value;
    });
  });

  return cleaned;
}

function diffTransformKeys(before: ConnectorConfig, after: ConnectorConfig) {
  const entriesBefore = Object.entries(before).filter(([key]) => key.startsWith('transforms.'));
  const entriesAfter = Object.entries(after).filter(([key]) => key.startsWith('transforms.'));
  const mapBefore = new Map(entriesBefore);
  const mapAfter = new Map(entriesAfter);

  const allKeys = new Set([...mapBefore.keys(), ...mapAfter.keys()]);
  const changes: Array<{ key: string; before?: string; after?: string }> = [];

  allKeys.forEach((key) => {
    const prev = mapBefore.get(key);
    const next = mapAfter.get(key);
    if (prev !== next) {
      changes.push({ key, before: prev, after: next });
    }
  });

  return changes;
}

interface TransformationsTabProps {
  name: string;
  initialConnector?: ConnectorGetResponse | null;
  onConfigUpdated?: (config: ConnectorGetResponse) => void;
}

const initialValidation: Record<string, ValidationState> = {};

const skeletons = Array.from({ length: 3 });

function ensureNoPlainSecrets(params: Record<string, string>) {
  const issues: string[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (secretPattern.test(key) && value && !value.startsWith('${secrets:/')) {
      issues.push(key);
    }
  });
  return issues;
}

export default function TransformationsTab({
  name,
  initialConnector,
  onConfigUpdated,
}: TransformationsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connector, setConnector] = useState<ConnectorGetResponse | null>(initialConnector ?? null);
  const [smts, setSmts] = useState<SMTItem[]>(() =>
    initialConnector ? parseFromConnectorConfig(initialConnector.config) : []
  );
  const [selectedAlias, setSelectedAlias] = useState<string | null>(smts[0]?.alias ?? null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [validations, setValidations] = useState<Record<string, ValidationState>>(initialValidation);
  const [previewInput, setPreviewInput] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [diff, setDiff] = useState<Array<{ key: string; before?: string; after?: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const [connectorRes, pluginsRes] = await Promise.all([
          initialConnector ? Promise.resolve(initialConnector) : getConnector(name),
          listPlugins(),
        ]);
        if (ignore) return;
        setConnector(connectorRes);
        const parsed = parseFromConnectorConfig(connectorRes.config);
        setSmts(parsed);
        setSelectedAlias((alias) => alias ?? parsed[0]?.alias ?? null);
        const available = pluginsRes.filter(
          (plugin) => plugin.type === 'transformation' || /Transform/i.test(plugin.class)
        );
        setPlugins(available);
        setError(null);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load transformations');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [initialConnector, name]);

  useEffect(() => {
    if (!selectedAlias) return;
    const item = smts.find((smt) => smt.alias === selectedAlias);
    if (!item || !item.className) return;

    const fingerprint = JSON.stringify(item);
    const validationState = validations[selectedAlias];
    if (validationState?.fingerprint === fingerprint) {
      return;
    }

    const handler = window.setTimeout(() => {
      runValidation(selectedAlias, item);
    }, 450);

    return () => {
      window.clearTimeout(handler);
    };
  }, [selectedAlias, smts, validations]);

  const runValidation = useCallback(
    async (alias: string, item: SMTItem) => {
      if (!item.className) return;
      const prefix = `transforms.${alias}`;
      const payload: Record<string, string> = {
        [`${prefix}.type`]: item.className,
      };
      Object.entries(item.params).forEach(([key, value]) => {
        if (value !== undefined) {
          payload[`${prefix}.${key}`] = value;
        }
      });

      try {
        const response = await validateTransform(item.className, payload);
        setValidations((current) => ({
          ...current,
          [alias]: { response, fingerprint: JSON.stringify(item) },
        }));
      } catch (err) {
        setValidations((current) => ({
          ...current,
          [alias]: {
            response: null,
            error: err instanceof Error ? err.message : 'Failed to validate transform',
            fingerprint: JSON.stringify(item),
          },
        }));
      }
    },
    []
  );

  const updateItem = useCallback(
    (currentAlias: string, updated: SMTItem) => {
      const aliasExists = smts.some(
        (item) => item.alias === updated.alias && item.alias !== currentAlias
      );
      if (aliasExists) {
        setStatusMessage(`Alias "${updated.alias}" is already in use.`);
        return;
      }

      Promise.resolve().then(() => {
        setSmts((items) =>
          items.map((item) => (item.alias === currentAlias ? { ...updated } : { ...item }))
        );
        setValidations((prev) => {
          const nextValidations: Record<string, ValidationState> = {};
          Object.entries(prev).forEach(([alias, state]) => {
            if (alias === currentAlias) {
              nextValidations[updated.alias] = state;
            } else if (alias !== updated.alias) {
              nextValidations[alias] = state;
            }
          });
          return nextValidations;
        });
        setSelectedAlias(updated.alias);
      });
    },
    [smts]
  );

  const removeItem = useCallback((alias: string) => {
    setSmts((items) => items.filter((item) => item.alias !== alias));
    setValidations((prev) => {
      const next = { ...prev };
      delete next[alias];
      return next;
    });
    setSelectedAlias((current) => {
      if (current === alias) {
        const remaining = smts.filter((item) => item.alias !== alias);
        return remaining[0]?.alias ?? null;
      }
      return current;
    });
  }, [smts]);

  const moveItem = useCallback((alias: string, direction: -1 | 1) => {
    setSmts((items) => {
      const index = items.findIndex((item) => item.alias === alias);
      if (index === -1) return items;
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      return next;
    });
  }, []);

  const addNewTransform = useCallback(
    (item: SMTItem) => {
      setSmts((items) => {
        if (items.some((existing) => existing.alias === item.alias)) {
          setStatusMessage(`Alias "${item.alias}" is already in use.`);
          return items;
        }
        return [...items, item];
      });
      setSelectedAlias(item.alias);
      runValidation(item.alias, item);
    },
    [runValidation]
  );

  const handleSave = useCallback(async () => {
    if (!connector) return;
    if (smts.some((item) => ensureNoPlainSecrets(item.params).length > 0)) {
      setStatusMessage('Sensitive parameters must reference a secret (${secrets:/...}).');
      return;
    }

    const validationIssues = Object.values(validations).some((state) => {
      const response = state?.response;
      return response && response.error_count > 0;
    });
    if (validationIssues) {
      setStatusMessage('Resolve validation errors before saving.');
      return;
    }

    const nextConfig = applyToConnectorConfig(connector.config, smts);
    const changes = diffTransformKeys(connector.config, nextConfig);
    setDiff(changes);
    setShowConfirm(true);
  }, [connector, smts, validations]);

  const confirmSave = useCallback(async () => {
    if (!connector) return;
    try {
      setSaving(true);
      const nextConfig = applyToConnectorConfig(connector.config, smts);
      const response = await putConnectorConfig(name, nextConfig);
      const refreshed = await getConnector(name);
      setConnector(refreshed);
      setSmts(parseFromConnectorConfig(refreshed.config));
      setValidations({});
      setStatusMessage('Transformations saved successfully.');
      setShowConfirm(false);
      setDiff([]);
      onConfigUpdated?.(refreshed);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save transformations');
    } finally {
      setSaving(false);
    }
  }, [connector, smts, name, onConfigUpdated]);

  const cancelSave = useCallback(() => {
    setShowConfirm(false);
    setDiff([]);
  }, []);

  const selectedItem = useMemo(
    () => smts.find((item) => item.alias === selectedAlias) ?? null,
    [selectedAlias, smts]
  );

  const selectedValidation = selectedAlias ? validations[selectedAlias] : undefined;

  if (loading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8" aria-busy>
        <header className="mb-6 space-y-2">
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        </header>
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {skeletons.map((_, index) => (
            <div key={index} className="h-48 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <h2 className="text-lg font-semibold">Unable to load transformations</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Transformations (SMTs)</h1>
            <p className="text-sm text-muted-foreground">
              Configure Single Message Transforms to shape records before they reach your topics. Learn more in the{' '}
              <a
                href="https://kafka.apache.org/documentation/#connect_transforms"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                documentation
              </a>.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
            {smts.length} transform{smts.length === 1 ? '' : 's'}
          </span>
        </div>
        {statusMessage ? (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {statusMessage}
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <TransformList
          items={smts}
          selectedAlias={selectedAlias}
          onSelect={setSelectedAlias}
          onMove={moveItem}
          onRemove={removeItem}
          onAdd={addNewTransform}
          availablePlugins={plugins}
          onValidate={runValidation}
        />

        <div className="space-y-6">
          <TransformEditor
            item={selectedItem}
            availablePlugins={plugins}
            onChange={(updated) => {
              if (!selectedItem) return;
              const issues = ensureNoPlainSecrets(updated.params);
              if (issues.length > 0) {
                setStatusMessage(
                  `Sensitive parameter${issues.length > 1 ? 's' : ''} (${issues.join(', ')}) must reference a secret.`
                );
              } else {
                setStatusMessage(null);
              }
              updateItem(selectedItem.alias, updated);
            }}
            validation={selectedValidation?.response ?? null}
            validationError={selectedValidation?.error ?? null}
          />
          <PreviewPanel value={previewInput} onChange={setPreviewInput} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Changes are applied to the connector configuration. Validation must succeed before saving.
        </p>
        <div className="flex items-center gap-3">
          <LoadingButton
            variant="secondary"
            onClick={() => {
              if (!connector) return;
              const resetItems = parseFromConnectorConfig(connector.config);
              setSmts(resetItems);
              setValidations({});
              setSelectedAlias(resetItems[0]?.alias ?? null);
              setStatusMessage('Changes discarded.');
            }}
            disabled={saving}
            className="rounded-full"
          >
            Reset
          </LoadingButton>
          <LoadingButton
            variant="primary"
            onClick={handleSave}
            loading={saving}
            loadingText="Saving..."
            className="rounded-full"
          >
            Save Changes
          </LoadingButton>
        </div>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Confirm updates</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The following <code className="rounded bg-muted px-1">transforms.*</code> keys will be updated.
            </p>
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Key</th>
                    <th className="px-3 py-2 text-left font-medium">Before</th>
                    <th className="px-3 py-2 text-left font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.length === 0 ? (
                    <tr>
                      <td className="px-3 py-2" colSpan={3}>
                        No changes detected.
                      </td>
                    </tr>
                  ) : (
                    diff.map((entry) => (
                      <tr key={entry.key} className="border-t border-border/80">
                        <td className="px-3 py-2 font-mono text-xs">{entry.key}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {entry.before ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{entry.after ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                type="button"
                onClick={cancelSave}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                type="button"
                onClick={confirmSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
