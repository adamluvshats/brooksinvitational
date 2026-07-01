"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, api, ApiError } from "@/lib/client";
import { useMe } from "@/lib/useMe";

interface TournamentListItem {
  id: string;
  name: string;
  year: number;
  status: string;
  _count: { players: number; rounds: number };
}

export default function HomePage() {
  const { me, isLoading } = useMe();

  if (isLoading) return <p className="text-fairway-600">Loading…</p>;
  if (!me) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="mb-2 text-2xl font-bold">⛳ Brooks Invitational</h1>
        <p className="mb-4 text-fairway-700">
          Live scoring, the Brooks handicap & points system, and round-by-round smack talk.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/login" className="btn-primary">Log in</Link>
          <Link href="/register" className="btn-ghost">Sign up</Link>
        </div>
      </div>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const { data, mutate } = useSWR<{ tournaments: TournamentListItem[] }>("/api/tournaments", fetcher);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/tournaments", { name, year: Number(year) });
      setName("");
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create");
    } finally {
      setBusy(false);
    }
  }

  const tournaments = data?.tournaments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your tournaments</h1>
      </div>

      {tournaments.length === 0 && (
        <p className="text-fairway-600">No tournaments yet — create your first one below.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t) => (
          <Link key={t.id} href={`/tournaments/${t.id}`} className="card transition hover:ring-fairway-300">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t.name}</h2>
              <span className="rounded bg-fairway-100 px-2 py-0.5 text-xs font-semibold text-fairway-700">
                {t.status}
              </span>
            </div>
            <p className="text-sm text-fairway-600">{t.year}</p>
            <p className="mt-2 text-xs text-fairway-500">
              {t._count.players} players · {t._count.rounds} rounds
            </p>
          </Link>
        ))}
      </div>

      <form onSubmit={create} className="card max-w-md space-y-3">
        <h2 className="font-bold">Create a tournament</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Brooks Invitational" />
        </div>
        <div>
          <label className="label">Year</label>
          <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={busy || !name}>{busy ? "…" : "Create"}</button>
      </form>
    </div>
  );
}
