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
  if (!me) return <Landing />;
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

// ---------------------------------------------------------------------------
// Public landing page (shown when logged out)
// ---------------------------------------------------------------------------

interface FeaturedData {
  featured: {
    name: string;
    year: number;
    status: string;
    standings: { rank: number; name: string; points: number; handicapClass: string }[];
  } | null;
  champions: { year: number; champion: string; runnerUp?: string }[];
}

const FEATURES = [
  { icon: "⚡", title: "Live scoring", body: "Every group enters their true score hole-by-hole and the whole field updates in seconds — no waiting for the turn." },
  { icon: "🎚️", title: "Tier handicap engine", body: "Scratch / A / B / C / D classes map to strokes on the hardest holes. Partners don't stack — the team plays off the higher handicap." },
  { icon: "🏅", title: "Hole-by-hole points", body: "Net scores decide each hole automatically. Win it and every player on your team banks a point; ties split to all tied teams." },
  { icon: "🚀", title: "Longest Drive & Closest to Pin", body: "A par-5 and a par-3 each round. Post your number live, get beaten, reclaim it. Holders earn a point — 11 max per round." },
  { icon: "🔄", title: "Round-robin & playoff", body: "Seven 2-man mixed scrambles rotate every partner, then a seeded stroke-play playoff crowns the champion." },
  { icon: "💬", title: "Smack-talk chat", body: "Trash talk in real time and tag anyone with @mentions so they can't miss it." },
  { icon: "🔐", title: "Roles & permissions", body: "Administrators fix anything, tournament admins manage their event, players edit only their own scores." },
  { icon: "📚", title: "Your history", body: "Every account keeps a record of tournaments and results to look back on." },
];

const RULES: { n: string; text: string }[] = [
  { n: "Field", text: "8 to 16 players. Each carries a handicap class — Scratch (0), A (5), B (10), C (15), or D (20) over an 18-hole course." },
  { n: "Handicaps", text: "Strokes fall on the hardest holes by stroke index (1 = hardest). A 15-handicap might get 8 strokes on the front and 7 on the back depending on where the tough holes are." },
  { n: "Scramble teams", text: "Partners don't stack — the team plays off the higher partner's handicap (a 5 & 10 pairing gets strokes on the 10 hardest holes; a 10 & 15 pairing, the 15 hardest)." },
  { n: "Winning a hole", text: "Enter your gross score; the app nets it and decides the hole. Lowest net wins — every player on the winning team scores a point, and ties split to all tied teams." },
  { n: "Skills contests", text: "Each round has one Longest Drive (par 5) and one Closest to Pin (par 3). The leader at the end of the round earns a point — so a single round is worth up to 11 points." },
  { n: "The playoff", text: "After 7 round-robin scrambles, players are seeded by total points and paired 1v2, 3v4, 5v6, 7v8 for a stroke-play playoff with handicaps still applied." },
  { n: "Final positions", text: "The winner of each playoff pair takes the higher of its two spots — so a player can climb at most one position. A #4 can reach 3rd, never 1st." },
];

function Landing() {
  const { data } = useSWR<FeaturedData>("/api/public/featured", fetcher);
  const featured = data?.featured ?? null;
  const champions = data?.champions ?? [];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-2xl bg-fairway-700 px-6 py-12 text-center text-white shadow-sm sm:px-12 sm:py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-fairway-200">The Brooks Invitational</p>
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Live scoring for golf&apos;s most unusual format.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-fairway-100">
          A round-robin of 2-man mixed scrambles, a tier-based handicap system, hole-by-hole points,
          skills contests, and a seeded playoff — all scored automatically while every group watches the
          board move in real time.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/register" className="rounded-md bg-white px-5 py-2.5 font-semibold text-fairway-800 hover:bg-fairway-50">
            Create your account
          </Link>
          <Link href="/login" className="rounded-md bg-fairway-600 px-5 py-2.5 font-semibold text-white ring-1 ring-fairway-400 hover:bg-fairway-500">
            Log in
          </Link>
        </div>
      </section>

      {/* Live leaderboard */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Live leaderboard</h2>
          {featured && (
            <span className="rounded bg-fairway-100 px-2 py-1 text-xs font-semibold text-fairway-700">
              {featured.name} · {featured.year} · {featured.status}
            </span>
          )}
        </div>
        <div className="card overflow-x-auto">
          {featured && featured.standings.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fairway-100 text-left text-xs uppercase text-fairway-500">
                  <th className="py-2 pr-2">Pos</th>
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2">Class</th>
                  <th className="py-2 pr-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {featured.standings.map((s) => (
                  <tr key={s.rank + s.name} className="border-b border-fairway-50">
                    <td className="py-2 pr-2 font-bold text-fairway-700">{s.rank}</td>
                    <td className="py-2 pr-2 font-semibold">{s.name}</td>
                    <td className="py-2 pr-2 text-fairway-600">{s.handicapClass}</td>
                    <td className="py-2 pr-2 text-right text-base font-bold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-fairway-500">
              No live tournament right now. Sign in to start one — the standings will appear here for everyone to follow.
            </p>
          )}
        </div>
      </section>

      {/* Feature breakdown */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">What&apos;s inside</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="mb-2 text-2xl">{f.icon}</div>
              <h3 className="mb-1 font-bold">{f.title}</h3>
              <p className="text-sm text-fairway-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tournament rules */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Tournament rules</h2>
        <div className="card divide-y divide-fairway-100">
          {RULES.map((r) => (
            <div key={r.n} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <span className="w-28 shrink-0 text-sm font-bold uppercase tracking-wide text-fairway-700">{r.n}</span>
              <p className="text-sm text-fairway-700">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hall of Champions */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">🏆 Hall of Champions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {champions.map((c) => (
            <div key={c.year} className="card flex items-center gap-4">
              <div className="text-2xl font-extrabold text-fairway-300">{c.year}</div>
              <div>
                <div className="font-bold">{c.champion}</div>
                {c.runnerUp && <div className="text-xs text-fairway-500">runner-up: {c.runnerUp}</div>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-fairway-500">
          Champions from tournaments run in the app appear automatically once marked complete.
        </p>
      </section>

      {/* Footer CTA */}
      <section className="rounded-2xl bg-fairway-100 px-6 py-10 text-center">
        <h2 className="text-2xl font-bold text-fairway-800">Ready to tee it up?</h2>
        <p className="mx-auto mt-2 max-w-md text-fairway-700">
          Create an account, set up your field and course, and let the app handle the rest.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/register" className="btn-primary">Get started</Link>
          <Link href="/login" className="btn-ghost">Log in</Link>
        </div>
      </section>
    </div>
  );
}
