'use client';

import { useEffect, useMemo, useState } from 'react';

import type { PluginInfo, SMTItem, ValidateResponse } from '@/types/connect';

interface TransformEditorProps {
  item: SMTItem | null;
  availablePlugins: PluginInfo[];
  onChange: (updated: SMTItem) => void;
  validation: ValidateResponse | null;
  validationError?: string | null;
}

interface FieldDefinition {
  name: string;
  displayName: string;
  required: boolean;
  documentation?: string;
  defaultValue?: string;
  errors?: string[];
}

function buildFieldDefinitions(validation: ValidateResponse | null, alias: string | null) {
  if (!validation || !alias) return [] as FieldDefinition[];
  const prefix = `transforms.${alias}.`;
  const fields: FieldDefinition[] = [];

  validation.configs?.forEach((entry: any) => {
    const definition = entry?.definition ?? entry?.value;
    const name: string | undefined = definition?.name ?? entry?.definition?.name;
    if (!name || !name.startsWith(prefix)) return;
    if (name === `${prefix}type`) return;
    const shortName = name.substring(prefix.length);
    fields.push({
      name: shortName,
      displayName: definition?.display_name ?? shortName,
      required: Boolean(definition?.required),
      documentation: definition?.documentation,
      defaultValue: definition?.default_value,
      errors: entry?.errors,
    });
  });

  const unique = new Map<string, FieldDefinition>();
  fields.forEach((field) => {
    if (!unique.has(field.name)) {
      unique.set(field.name, field);
    }
  });
  return Array.from(unique.values());
}

export default function TransformEditor({
  item,
  availablePlugins,
  onChange,
  validation,
  validationError,
}: TransformEditorProps) {
  const [local, setLocal] = useState<SMTItem | null>(item);

  useEffect(() => {
    setLocal(item);
  }, [item]);

  const pluginOptions = useMemo(() => {
    const sorted = [...availablePlugins];
    sorted.sort((a, b) => a.class.localeCompare(b.class));
    return sorted;
  }, [availablePlugins]);

  const fieldDefinitions = useMemo(
    () => buildFieldDefinitions(validation, local?.alias ?? item?.alias ?? null),
    [validation, local?.alias, item?.alias]
  );

  if (!local) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Select a transform to configure it.
      </div>
    );
  }

  const updateParams = (name: string, value: string) => {
    setLocal((current) => {
      if (!current) return current;
      const params = { ...current.params, [name]: value };
      const updated = { ...current, params };
      onChange(updated);
      return updated;
    });
  };

  const removeParam = (name: string) => {
    setLocal((current) => {
      if (!current) return current;
      const params = { ...current.params };
      delete params[name];
      const updated = { ...current, params };
      onChange(updated);
      return updated;
    });
  };

  const addParam = () => {
    const nextName = `param${Object.keys(local.params).length + 1}`;
    updateParams(nextName, '');
  };

  const setAlias = (value: string) => {
    setLocal((current) => {
      if (!current) return current;
      const updated = { ...current, alias: value.trim() };
      onChange(updated);
      return updated;
    });
  };

  const setClassName = (value: string) => {
    setLocal((current) => {
      if (!current) return current;
      const updated = { ...current, className: value };
      onChange(updated);
      return updated;
    });
  };

  const inlineErrors = fieldDefinitions.reduce<Record<string, string[]>>((acc, field) => {
    if (field.errors?.length) {
      acc[field.name] = field.errors;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configure Transform</h2>
        <span className="text-xs text-muted-foreground">Alias + parameters</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Alias
          <input
            type="text"
            value={local.alias}
            onChange={(event) => setAlias(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="block text-sm font-medium">
          Class
          <select
            value={local.className}
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
      </div>
      {validationError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {validationError}
        </div>
      ) : null}
      {validation?.error_count ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {validation.error_count} validation error{validation.error_count === 1 ? '' : 's'} detected. Fix highlighted fields.
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Parameters</h3>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={addParam}
          >
            Add parameter
          </button>
        </div>
        {fieldDefinitions.length > 0 ? (
          <div className="space-y-4">
            {fieldDefinitions.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="block text-sm font-medium">
                  {field.displayName}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                  <input
                    type="text"
                    value={local.params[field.name] ?? ''}
                    onChange={(event) => updateParams(field.name, event.target.value)}
                    placeholder={field.defaultValue ?? ''}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      inlineErrors[field.name]?.length
                        ? 'border-destructive focus:ring-destructive'
                        : 'border-border focus:ring-primary'
                    }`}
                  />
                </label>
                {field.documentation ? (
                  <p className="text-xs text-muted-foreground">{field.documentation}</p>
                ) : null}
                {inlineErrors[field.name]?.map((message, index) => (
                  <p key={index} className="text-xs text-destructive">
                    {message}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Additional parameters</p>
          {Object.entries(local.params)
            .filter(([name]) => fieldDefinitions.every((field) => field.name !== name))
            .map(([name, value]) => (
              <div key={name} className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setLocal((current) => {
                      if (!current) return current;
                      const params = { ...current.params };
                      delete params[name];
                      params[nextName] = value;
                      const updated = { ...current, params };
                      onChange(updated);
                      return updated;
                    });
                  }}
                  className="w-1/2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(event) => updateParams(name, event.target.value)}
                  className="w-1/2 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeParam(name)}
                >
                  Remove
                </button>
              </div>
            ))}
          {Object.entries(local.params).length === 0 ? (
            <p className="text-xs text-muted-foreground">No additional parameters yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
