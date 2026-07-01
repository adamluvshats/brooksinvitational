"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number | undefined;
  net?: number | null;
  won?: boolean;
  editable: boolean;
  onSave: (strokes: number) => Promise<void>;
}

/** A single editable gross-score cell. Saves on blur/Enter; shows net + win highlight. */
export function ScoreCell({ value, net, won, editable, onSave }: Props) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  async function commit() {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 1) {
      setDraft(value?.toString() ?? "");
      return;
    }
    if (n === value) return;
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`relative flex flex-col items-center rounded ${won ? "bg-fairway-100 ring-1 ring-fairway-400" : ""}`}>
      <input
        className="w-11 rounded border border-fairway-200 bg-white px-1 py-1 text-center text-sm outline-none focus:border-fairway-500 disabled:bg-fairway-50 disabled:text-fairway-500"
        inputMode="numeric"
        value={draft}
        disabled={!editable || saving}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {typeof net === "number" && draft !== "" && (
        <span className={`text-[10px] ${won ? "font-bold text-fairway-700" : "text-fairway-400"}`}>
          net {net}
        </span>
      )}
    </div>
  );
}
