'use client';

import { useState } from 'react';

import { bulkConnectorAction, type ConnectorAction } from '@/lib/api';

interface ConnectorBulkActionsProps {
  selected: string[];
  onClearSelection: () => void;
  onActionComplete?: () => void | Promise<void>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  className?: string;
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

export function ConnectorBulkActions({
  selected,
  onClearSelection,
  onActionComplete,
  onSuccess,
  onError: onErrorCallback,
  className,
}: ConnectorBulkActionsProps) {
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

      // Show success toast
      if (result.failures.length === 0) {
        const count = result.successes.length;
        const connectorWord = count === 1 ? 'connector' : 'connectors';
        onSuccess?.(`${count} ${connectorWord} ${action}d successfully`);
        onClearSelection();
      } else if (result.successes.length > 0) {
        // Partial success
        const successCount = result.successes.length;
        const failCount = result.failures.length;
        onSuccess?.(`${successCount} succeeded, ${failCount} failed`);
      } else {
        // All failed
        onErrorCallback?.(`Failed to ${action} ${selectedCount} connector${selectedCount === 1 ? '' : 's'}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to run bulk action';
      setError(errorMessage);
      onErrorCallback?.(errorMessage);
    } finally {
      setActiveAction(null);
    }
  };

  const summaryVariant = summary && summary.failures.length > 0 ? 'warning' : 'success';

  return (
    <div
      className={`flex w-full flex-col gap-4 rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface)] px-5 py-4 shadow-md shadow-[color:var(--shadow)]/30 md:flex-row md:items-center md:justify-between ${className ?? ''}`.trim()}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--foreground-strong)]">
          {selectedCount} connector{selectedCount === 1 ? '' : 's'} selected
        </p>
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Choose an action to apply across the current selection.
        </p>
        {error ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        {summary ? (
          <div
            className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${
              summaryVariant === 'warning'
                ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
            }`}
          >
            <p>
              {actionPastTense[summary.action]} {summary.successes.length} of {summary.total} connector
              {summary.total === 1 ? '' : 's'}.
            </p>
            {summary.failures.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs">
                {summary.failures.map((failure) => (
                  <li key={failure.name}>
                    <span className="font-semibold">{failure.name}</span>: {failure.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actionOrder.map((action) => {
          const isDanger = action === 'delete';
          const isBusy = activeAction === action;
          const label = isBusy ? actionLoadingLabels[action] : actionLabels[action];
          const baseClasses =
            'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
          const toneClasses = isDanger
            ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500 disabled:bg-rose-500/70'
            : 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-500 disabled:bg-emerald-500/70';

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
          className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-muted)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
