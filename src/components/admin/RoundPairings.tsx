"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { PlayerLite, TeamWithMembers } from "@/lib/types";

interface Props {
  tournamentId: string;
  roundId: string;
  players: PlayerLite[];
  existingTeams: TeamWithMembers[];
  onSaved: () => void;
}

export function RoundPairings({ tournamentId, roundId, players, existingTeams, onSaved }: Props) {
  const [teams, setTeams] = useState<string[][]>(
    existingTeams.length
      ? existingTeams.map((t) => t.members.map((m) => m.playerId))
      : [["", ""]],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setSlot(teamIdx: number, slot: number, playerId: string) {
    setTeams((ts) => ts.map((t, i) => (i === teamIdx ? t.map((p, s) => (s === slot ? playerId : p)) : t)));
  }

  const used = new Set(teams.flat().filter(Boolean));

  async function save() {
    setError(null);
    const payload = teams
      .map((t) => t.filter(Boolean))
      .filter((t) => t.length > 0)
      .map((playerIds) => ({ playerIds }));
    if (payload.length === 0) {
      setError("Add at least one team");
      return;
    }
    setBusy(true);
    try {
      await api.put(`/api/tournaments/${tournamentId}/rounds/${roundId}/teams`, { teams: payload });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save pairings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-fairway-500">
        Partners change every 9-hole round (round-robin). Re-saving pairings clears any scores already entered for this round.
      </p>
      {teams.map((team, ti) => (
        <div key={ti} className="flex items-center gap-2">
          <span className="w-14 text-xs font-semibold text-fairway-500">Team {ti + 1}</span>
          {[0, 1].map((slot) => (
            <select
              key={slot}
              className="input max-w-[12rem]"
              value={team[slot] ?? ""}
              onChange={(e) => setSlot(ti, slot, e.target.value)}
            >
              <option value="">—</option>
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={used.has(p.id) && team[slot] !== p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          ))}
          <button type="button" className="text-sm text-red-600" onClick={() => setTeams((ts) => ts.filter((_, i) => i !== ti))}>
            ✕
          </button>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => setTeams((ts) => [...ts, ["", ""]])}>
          + Add team
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          Save pairings
        </button>
      </div>
    </div>
  );
}
