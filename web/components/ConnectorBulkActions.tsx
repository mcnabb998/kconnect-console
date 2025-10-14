'use client';

import { useState } from 'react';

import { bulkConnectorAction, type ConnectorAction } from '@/lib/api';

interface ConnectorBulkActionsProps {
  selected: string[];
  onClearSelection: () => void;
  onActionComplete?: () => void | Promise<void>;
}

interface BulkSummary {
  action: ConnectorAction;
  total: number;
  successes: string[];
  failures: Array<{ name: string; error: string }>;
}

const actionLabels: Record<ConnectorAction, string> = {
  pause: 'Pause',
  resume: 'Resume',
  restart: 'Restart',
  delete: 'Delete',
};

const actionLoadingLabels: Record<ConnectorAction, string> = {
  pause: 'Pausing…',
  resume: 'Resuming…',
  restart: 'Restarting…',
  delete: 'Deleting…',
};

const actionPastTense: Record<ConnectorAction, string> = {
  pause: 'Paused',
  resume: 'Resumed',
  restart: 'Restarted',
  delete: 'Deleted',
};

const actionOrder: ConnectorAction[] = ['pause', 'resume', 'restart', 'delete'];

export function ConnectorBulkActions({ selected, onClearSelection, onActionComplete }: ConnectorBulkActionsProps) {
  const [activeAction, setActiveAction] = useState<ConnectorAction | null>(null);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selected.length;
  const hasSelection = selectedCount > 0;

  const handleBulkAction = async (action: ConnectorAction) => {
    if (!hasSelection || activeAction) {
      return;
    }

    setActiveAction(action);
    setError(null);

    try {
      const result = await bulkConnectorAction(selected, action);
      const nextSummary: BulkSummary = {
        action,
        total: selectedCount,
        successes: result.successes,
        failures: result.failures,
      };
      setSummary(nextSummary);

      await onActionComplete?.();

      if (result.failures.length === 0) {
        onClearSelection();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run bulk action');
    } finally {
      setActiveAction(null);
    }
  };

  const summaryVariant = summary && summary.failures.length > 0 ? 'warning' : 'success';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            {selectedCount} connector{selectedCount === 1 ? '' : 's'} selected
          </p>
          <p className="text-xs text-emerald-700">Apply bulk actions across the selected connectors.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actionOrder.map((action) => {
            const isDanger = action === 'delete';
            const isBusy = activeAction === action;
            const label = isBusy ? actionLoadingLabels[action] : actionLabels[action];
            const baseClasses =
              'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
            const toneClasses = isDanger
              ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500 disabled:bg-rose-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-500 disabled:bg-emerald-400';

            return (
              <button
                key={action}
                type="button"
                onClick={() => handleBulkAction(action)}
                disabled={!hasSelection || Boolean(activeAction)}
                className={`${baseClasses} ${toneClasses} disabled:cursor-not-allowed disabled:opacity-80`}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onClearSelection}
            disabled={!hasSelection || Boolean(activeAction)}
            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Clear selection
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {summary && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            summaryVariant === 'warning'
              ? 'border border-amber-200 bg-amber-50 text-amber-900'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <p className="font-semibold">
            {actionPastTense[summary.action]} {summary.successes.length} of {summary.total} connector
            {summary.total === 1 ? '' : 's'}.
          </p>
          {summary.failures.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {summary.failures.map((failure) => (
                <li key={failure.name}>
                  <span className="font-semibold">{failure.name}</span>: {failure.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
