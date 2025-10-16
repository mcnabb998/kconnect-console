'use client';

import { useMemo, useState } from 'react';

import type { PluginInfo, SMTItem } from '@/types/connect';

interface TransformListProps {
  items: SMTItem[];
  selectedAlias: string | null;
  onSelect: (alias: string) => void;
  onMove: (alias: string, direction: -1 | 1) => void;
  onRemove: (alias: string) => void;
  onAdd: (item: SMTItem) => void;
  availablePlugins: PluginInfo[];
  onValidate: (alias: string, item: SMTItem) => void;
}

const aliasPattern = /^[a-zA-Z0-9_.-]+$/;

export default function TransformList({
  items,
  selectedAlias,
  onSelect,
  onMove,
  onRemove,
  onAdd,
  availablePlugins,
  onValidate,
}: TransformListProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [alias, setAlias] = useState('');
  const [className, setClassName] = useState('');
  const [paramDrafts, setParamDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const pluginOptions = useMemo(() => {
    const sorted = [...availablePlugins];
    sorted.sort((a, b) => a.class.localeCompare(b.class));
    return sorted;
  }, [availablePlugins]);

  const summaryFor = (item: SMTItem) => {
    const entries = Object.entries(item.params);
    if (entries.length === 0) {
      return 'No parameters';
    }
    return entries
      .slice(0, 2)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  };

  const resetDialog = () => {
    setAlias('');
    setClassName('');
    setParamDrafts({});
    setError(null);
  };

  const handleAdd = () => {
    if (!aliasPattern.test(alias)) {
      setError('Alias may only include letters, numbers, dot, dash, or underscore.');
      return;
    }
    if (!className) {
      setError('Select a transform class.');
      return;
    }
    const params: Record<string, string> = {};
    Object.entries(paramDrafts).forEach(([key, value]) => {
      if (key) params[key] = value;
    });
    const item: SMTItem = { alias, className, params };
    onAdd(item);
    onValidate(alias, item);
    resetDialog();
    setShowDialog(false);
  };

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transforms</h2>
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-sm font-medium hover:bg-muted"
            onClick={() => setShowDialog(true)}
          >
            Add Transform
          </button>
        </div>
        {items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            <p className="font-medium">No transforms configured.</p>
            <p className="mt-1">Add a transform to modify records.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item, index) => {
              const isActive = item.alias === selectedAlias;
              return (
                <li
                  key={item.alias}
                  className={`rounded-2xl border px-4 py-3 shadow-sm transition-colors ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelect(item.alias)}
                      className="text-left"
                    >
                      <h3 className="text-base font-medium">{item.alias}</h3>
                      <p className="text-sm text-muted-foreground break-words">
                        {item.className}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/80">{summaryFor(item)}</p>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                          onClick={() => onMove(item.alias, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                          onClick={() => onMove(item.alias, 1)}
                          disabled={index === items.length - 1}
                        >
                          Down
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => onRemove(item.alias)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <header>
              <h3 className="text-lg font-semibold">Add Transform</h3>
              <p className="text-sm text-muted-foreground">
                Provide an alias and select a class. Required fields will be shown after creation.
              </p>
            </header>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Alias
                <input
                  type="text"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value.trim())}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. enrichHeaders"
                />
              </label>
              <label className="block text-sm font-medium">
                Class
                <select
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a transform</option>
                  {pluginOptions.map((plugin) => (
                    <option key={plugin.class} value={plugin.class}>
                      {plugin.title ?? plugin.class}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Parameters</span>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      setParamDrafts((prev) => ({ ...prev, [`field${Object.keys(prev).length + 1}`]: '' }))
                    }
                  >
                    Add field
                  </button>
                </div>
                {Object.entries(paramDrafts).length === 0 ? (
                  <p className="text-xs text-muted-foreground">You can add optional parameters now or later.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(paramDrafts).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(event) => {
                            const nextKey = event.target.value;
                            setParamDrafts((prev) => {
                              const copy = { ...prev };
                              delete copy[key];
                              copy[nextKey] = value;
                              return copy;
                            });
                          }}
                          className="w-1/2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="field"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(event) =>
                            setParamDrafts((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                          className="w-1/2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="value"
                        />
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={() => {
                            setParamDrafts((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => {
                  resetDialog();
                  setShowDialog(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={handleAdd}
              >
                Add Transform
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
