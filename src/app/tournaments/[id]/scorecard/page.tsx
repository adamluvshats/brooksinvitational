"use client";

import { use, useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher, api } from "@/lib/client";
import { useTournamentState } from "@/lib/useTournament";
import { useMe } from "@/lib/useMe";
import { ScoreCell } from "@/components/ScoreCell";
import { AchievementClaim } from "@/components/AchievementClaim";
import { strokesForHole } from "@/lib/scoring";
import type { TeamWithMembers } from "@/lib/types";

interface RoundData {
  teams: TeamWithMembers[];
  holeScores: { id: string; teamId: string; playerId: string | null; holeNumber: number; strokes: number }[];
  achievements: {
    id: string;
    type: "LONGEST_DRIVE" | "CLOSEST_TO_PIN";
    holeNumber: number;
    claim: { playerId: string; distance: number; unit: string; player?: { id: string; displayName: string } } | null;
  }[];
}

export default function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, mutate: mutateState } = useTournamentState(id);
  const { me } = useMe();
  const [roundId, setRoundId] = useState<string>("");

  useEffect(() => {
    if (!roundId && state?.rounds.length) {
      const active = state.rounds.find((r) => r.status === "ACTIVE") ?? state.rounds[0];
      setRoundId(active.roundId);
    }
  }, [state, roundId]);

  const { data: roundData, mutate: mutateRound } = useSWR<RoundData>(
    roundId ? `/api/tournaments/${id}/rounds/${roundId}/teams` : null,
    fetcher,
    { refreshInterval: 4000 },
  );

  if (!state) return <p className="text-fairway-600">Loading…</p>;
  if (state.rounds.length === 0) {
    return <p className="text-fairway-600">No rounds yet. An admin can create rounds on the Admin tab.</p>;
  }

  const round = state.rounds.find((r) => r.roundId === roundId);
  const myPlayer = state.players.find((p) => p.userId === me?.id);
  const isAdmin = me?.role === "ADMIN" || myPlayer?.role === "TOURNAMENT_ADMIN";
  const teams = roundData?.teams ?? [];

  const grossFor = (teamId: string, playerId: string | null, holeNumber: number) =>
    roundData?.holeScores.find(
      (s) => s.teamId === teamId && s.playerId === playerId && s.holeNumber === holeNumber,
    )?.strokes;

  const canEditTeam = (team: TeamWithMembers) =>
    Boolean(isAdmin || (myPlayer && team.members.some((m) => m.playerId === myPlayer.id)));

  async function save(teamId: string, playerId: string | null, holeNumber: number, strokes: number) {
    await api.post(`/api/tournaments/${id}/scores`, { roundId, teamId, playerId, holeNumber, strokes });
    await Promise.all([mutateRound(), mutateState()]);
  }

  const holes = round?.holes ?? [];
  const isPlayoff = round?.type === "PLAYOFF";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="label mb-0">Round</label>
        <select className="input max-w-xs" value={roundId} onChange={(e) => setRoundId(e.target.value)}>
          {state.rounds.map((r) => (
            <option key={r.roundId} value={r.roundId}>
              R{r.roundNumber} · {r.name} {r.type === "PLAYOFF" ? "(playoff)" : ""} — {r.status}
            </option>
          ))}
        </select>
      </div>

      {teams.length === 0 ? (
        <p className="text-fairway-600">No pairings set for this round yet (Admin tab).</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-xs uppercase text-fairway-500">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left">{isPlayoff ? "Player" : "Team"}</th>
                {holes.map((h) => (
                  <th key={h.number} className="px-1 py-2 text-center">
                    <div>{h.number}</div>
                    <div className="font-normal normal-case text-fairway-400">par {h.par} · SI {h.strokeIndex}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Tot</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const hr = round?.holeResults;
                const teamHcp = round?.teamHandicaps?.[team.id];
                if (isPlayoff) {
                  // One row per player; net computed from individual handicap.
                  return team.members.map((m) => {
                    const editable = canEditTeam(team);
                    let total = 0;
                    return (
                      <tr key={m.id} className="border-t border-fairway-50">
                        <td className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-semibold">
                          {m.player.displayName}
                          <span className="ml-1 text-xs font-normal text-fairway-500">hcp {m.player.handicap}</span>
                        </td>
                        {holes.map((h) => {
                          const g = grossFor(team.id, m.playerId, h.number);
                          if (typeof g === "number") total += g;
                          const net = typeof g === "number" ? g - strokesForHole(m.player.handicap, h.strokeIndex) : null;
                          return (
                            <td key={h.number} className="px-1 py-1 text-center">
                              <ScoreCell value={g} net={net} editable={editable} onSave={(s) => save(team.id, m.playerId, h.number, s)} />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold">{total || ""}</td>
                      </tr>
                    );
                  });
                }
                // Scramble: one shared row per team.
                const editable = canEditTeam(team);
                let total = 0;
                return (
                  <tr key={team.id} className="border-t border-fairway-50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-semibold">
                      {team.members.map((m) => m.player.displayName).join(" / ")}
                      {typeof teamHcp === "number" && (
                        <span className="ml-1 text-xs font-normal text-fairway-500">team hcp {teamHcp}</span>
                      )}
                    </td>
                    {holes.map((h) => {
                      const g = grossFor(team.id, null, h.number);
                      if (typeof g === "number") total += g;
                      const cell = hr?.find((x) => x.holeNumber === h.number)?.teams.find((t) => t.teamId === team.id);
                      return (
                        <td key={h.number} className="px-1 py-1 text-center">
                          <ScoreCell value={g} net={cell?.net ?? null} won={cell?.won} editable={editable} onSave={(s) => save(team.id, null, h.number, s)} />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-bold">{total || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {roundData && roundData.achievements.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {roundData.achievements.map((a) => (
            <AchievementClaim
              key={a.id}
              tournamentId={id}
              roundId={roundId}
              type={a.type}
              holeNumber={a.holeNumber}
              claim={a.claim}
              players={state.players}
              canClaim={Boolean(myPlayer || isAdmin)}
              onSaved={() => mutateRound()}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-fairway-500">
        Enter your true (gross) score per hole — the app applies handicaps and decides the winner of each hole automatically.
        {isPlayoff
          ? " Playoff rounds are stroke play: each player enters their own score."
          : " Net winners are highlighted; ties split the point to every player on each tied team."}
      </p>
    </div>
  );
}
