'use client';

interface PreviewPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PreviewPanel({ value, onChange }: PreviewPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Preview (Best-effort)</h2>
          <p className="text-sm text-muted-foreground">
            Kafka Connect validates fields but does not execute transforms remotely. Provide sample JSON to reason about
            the order of transforms.
          </p>
        </div>
      </header>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-48 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder={`{
  "key": {"id": 1},
  "value": {"name": "alice"},
  "headers": {"source": "demo"}
}`}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Preview simulates transform order locally for supported transforms (InsertField, ReplaceField). Other transforms
        show configuration only.
      </p>
    </div>
  );
}
