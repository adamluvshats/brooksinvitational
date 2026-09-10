"use client";

import { use } from "react";
import { useTournamentState } from "@/lib/useTournament";
import type { PlayerLite } from "@/lib/types";

export default function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, isLoading } = useTournamentState(id);

  if (isLoading || !state) return <p className="text-fairway-600">Loading leaderboard…</p>;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const name = (pid: string) => byId.get(pid)?.displayName ?? "?";
  const scrambleRounds = state.rounds.filter((r) => r.type === "SCRAMBLE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{state.name}</h1>
          <p className="text-sm text-fairway-600">Status: {state.status} · updates live</p>
        </div>
      </div>

      {state.finalPositions && (
        <section className="card">
          <h2 className="mb-2 font-bold">🏆 Final positions</h2>
          <ol className="space-y-1">
            {state.finalPositions.map((f) => (
              <li key={f.playerId} className="flex items-center gap-3 text-sm">
                <span className="w-8 font-bold text-fairway-700">#{f.finalPosition}</span>
                <span className="font-semibold">{name(f.playerId)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-bold">Points standings (7 scramble rounds)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fairway-100 text-left text-xs uppercase text-fairway-500">
              <th className="py-2 pr-2">Seed</th>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2">Class</th>
              {scrambleRounds.map((r) => (
                <th key={r.roundId} className="px-2 py-2 text-center" title={r.name}>R{r.roundNumber}</th>
              ))}
              <th className="px-2 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {state.standings.map((row) => {
              const p = byId.get(row.playerId) as PlayerLite | undefined;
              return (
                <tr key={row.playerId} className="border-b border-fairway-50">
                  <td className="py-2 pr-2 font-bold text-fairway-700">{row.rank}</td>
                  <td className="py-2 pr-2 font-semibold">{p?.displayName ?? "?"}</td>
                  <td className="py-2 pr-2 text-fairway-600">{p?.handicapClass} ({p?.handicap})</td>
                  {scrambleRounds.map((r) => (
                    <td key={r.roundId} className="px-2 py-2 text-center text-fairway-700">
                      {r.pointsByPlayer[row.playerId] ?? 0}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right text-lg font-bold">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {state.playoff && (
        <section className="card">
          <h2 className="mb-3 font-bold">Playoff bracket</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.playoff.pairs.map((pair) => (
              <div key={pair.bracketRank} className="rounded-lg ring-1 ring-fairway-100 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-fairway-500">
                  Positions #{pair.positions[0]} / #{pair.positions[1]}
                </p>
                {pair.results.map((res) => (
                  <div key={res.playerId} className={`flex justify-between text-sm ${res.won ? "font-bold text-fairway-800" : "text-fairway-600"}`}>
                    <span>{res.won ? "▶ " : ""}{name(res.playerId)} → #{res.finalPosition}</span>
                    <span>net {res.netTotal} ({res.grossTotal}-{res.strokesReceived})</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
