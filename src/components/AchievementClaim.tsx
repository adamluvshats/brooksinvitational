"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { PlayerLite } from "@/lib/types";

interface ClaimDto {
  playerId: string;
  distance: number;
  unit: string;
  player?: { id: string; displayName: string };
}

interface Props {
  tournamentId: string;
  roundId: string;
  type: "LONGEST_DRIVE" | "CLOSEST_TO_PIN";
  holeNumber: number;
  claim: ClaimDto | null;
  players: PlayerLite[];
  canClaim: boolean;
  onSaved: () => void;
}

const LABELS = {
  LONGEST_DRIVE: { title: "🚀 Longest Drive", defaultUnit: "yds" },
  CLOSEST_TO_PIN: { title: "🎯 Closest to Pin", defaultUnit: "ft" },
};

export function AchievementClaim({ tournamentId, roundId, type, holeNumber, claim, players, canClaim, onSaved }: Props) {
  const cfg = LABELS[type];
  const [playerId, setPlayerId] = useState(claim?.playerId ?? "");
  const [distance, setDistance] = useState(claim?.distance?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const holderName =
    claim?.player?.displayName ?? players.find((p) => p.id === claim?.playerId)?.displayName;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dist = parseFloat(distance);
    if (!playerId || !Number.isFinite(dist)) {
      setError("Pick a player and enter a distance");
      return;
    }
    setBusy(true);
    try {
      const slug = type === "LONGEST_DRIVE" ? "LD" : "CTP";
      await api.put(`/api/tournaments/${tournamentId}/rounds/${roundId}/achievements/${slug}`, {
        playerId,
        distance: dist,
        unit: cfg.defaultUnit,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg p-3 ring-1 ring-fairway-100">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">{cfg.title}</h3>
        <span className="text-xs text-fairway-500">Hole {holeNumber}</span>
      </div>
      <p className="mb-2 text-sm">
        {claim ? (
          <>
            Leader: <span className="font-bold">{holderName ?? "?"}</span> —{" "}
            {claim.distance} {claim.unit}
          </>
        ) : (
          <span className="text-fairway-500">No one yet — be the first to post.</span>
        )}
      </p>
      {canClaim && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <select className="input max-w-[10rem]" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
          <input
            className="input max-w-[6rem]"
            inputMode="decimal"
            placeholder={cfg.defaultUnit}
            value={distance}
            onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <button className="btn-primary" disabled={busy}>{claim ? "Update" : "Claim"}</button>
        </form>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
