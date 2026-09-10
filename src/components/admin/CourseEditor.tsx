"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";

interface HoleDraft { number: number; par: number; strokeIndex: number; }

function standardHoles(): HoleDraft[] {
  // Sensible default: par 4s, stroke index == hole number (admin edits as needed).
  return Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));
}

export function CourseEditor({ tournamentId, onCreated }: { tournamentId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [holes, setHoles] = useState<HoleDraft[]>(standardHoles());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setHole(idx: number, key: "par" | "strokeIndex", value: number) {
    setHoles((hs) => hs.map((h, i) => (i === idx ? { ...h, [key]: value } : h)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sis = new Set(holes.map((h) => h.strokeIndex));
    if (sis.size !== 18) {
      setError("Each hole needs a unique stroke index 1–18 (1 = hardest).");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/tournaments/${tournamentId}/courses`, { name, holes });
      setName("");
      setHoles(standardHoles());
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create course");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="max-w-sm">
        <label className="label">Course name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pine Valley" />
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-xs uppercase text-fairway-500">
              <th className="px-2 py-1 text-left">Hole</th>
              {holes.map((h) => (
                <th key={h.number} className="px-1 py-1 text-center">{h.number}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1 font-semibold">Par</td>
              {holes.map((h, i) => (
                <td key={h.number} className="px-1 py-1">
                  <input className="w-11 rounded border border-fairway-200 px-1 py-1 text-center" inputMode="numeric"
                    value={h.par} onChange={(e) => setHole(i, "par", parseInt(e.target.value || "0", 10))} />
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-2 py-1 font-semibold">Stroke index</td>
              {holes.map((h, i) => (
                <td key={h.number} className="px-1 py-1">
                  <input className="w-11 rounded border border-fairway-200 px-1 py-1 text-center" inputMode="numeric"
                    value={h.strokeIndex} onChange={(e) => setHole(i, "strokeIndex", parseInt(e.target.value || "0", 10))} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fairway-500">
        Stroke index ranks hole difficulty 1–18 (1 = hardest, 18 = easiest) and drives handicap stroke allocation.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !name}>Create course</button>
        <button type="button" className="btn-ghost" onClick={() => setHoles(standardHoles())}>Reset holes</button>
      </div>
    </form>
  );
}
