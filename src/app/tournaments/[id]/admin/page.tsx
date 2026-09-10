"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { fetcher, api, ApiError } from "@/lib/client";
import { useTournamentState } from "@/lib/useTournament";
import { useMe } from "@/lib/useMe";
import { CourseEditor } from "@/components/admin/CourseEditor";
import { RoundPairings } from "@/components/admin/RoundPairings";
import { CLASS_LABELS, type Course, type HandicapClass, type PlayerLite, type TeamWithMembers, type RoundComputation, type TournamentState } from "@/lib/types";

export default function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, mutate } = useTournamentState(id, 10000);
  const { me } = useMe();
  const { data: coursesData, mutate: mutateCourses } = useSWR<{ courses: Course[] }>(
    `/api/tournaments/${id}/courses`,
    fetcher,
  );

  if (!state || !me) return <p className="text-fairway-600">Loading…</p>;

  const myPlayer = state.players.find((p) => p.userId === me.id);
  const canManage = me.role === "ADMIN" || myPlayer?.role === "TOURNAMENT_ADMIN";
  if (!canManage) {
    return <p className="text-fairway-600">Only tournament admins and site administrators can manage this tournament.</p>;
  }

  const courses = coursesData?.courses ?? [];
  const refresh = () => Promise.all([mutate(), mutateCourses()]);

  return (
    <div className="space-y-6">
      <SettingsSection id={id} state={state} onSaved={mutate} />
      <PlayersSection id={id} state={state} onChanged={mutate} />
      <CoursesSection id={id} courses={courses} onChanged={refresh} />
      <RoundsSection id={id} state={state} courses={courses} onChanged={refresh} />
      <PlayoffSection id={id} state={state} courses={courses} onChanged={refresh} />
    </div>
  );
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-sm text-red-600">{msg}</p> : null;
}

function SettingsSection({ id, state, onSaved }: { id: string; state: TournamentState; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/tournaments/${id}`, data);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Settings</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Status</label>
          <select className="input" defaultValue={state.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>
            {["SETUP", "ACTIVE", "PLAYOFF", "COMPLETE"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Scramble handicap mode</label>
          <select className="input" defaultValue={state.handicapMode} disabled={busy} onChange={(e) => patch({ handicapMode: e.target.value })}>
            <option value="MAX">Higher partner (default)</option>
            <option value="DIFFERENCE">Difference</option>
            <option value="AVERAGE">Average</option>
          </select>
        </div>
      </div>
      <Err msg={error} />
    </section>
  );
}

function PlayersSection({ id, state, onChanged }: { id: string; state: TournamentState; onChanged: () => void }) {
  const [form, setForm] = useState({ displayName: "", handicapClass: "A" as HandicapClass, role: "PLAYER" });
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/tournaments/${id}/players`, form);
      setForm({ displayName: "", handicapClass: "A", role: "PLAYER" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add player");
    }
  }
  async function update(playerId: string, data: Record<string, unknown>) {
    try {
      await api.patch(`/api/tournaments/${id}/players/${playerId}`, data);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }
  async function remove(playerId: string) {
    if (!confirm("Remove this player?")) return;
    await api.del(`/api/tournaments/${id}/players/${playerId}`);
    onChanged();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Players ({state.players.length}/16)</h2>
      <div className="space-y-2">
        {state.players.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-fairway-50 pb-2">
            <span className="w-40 font-semibold">{p.displayName}</span>
            <select className="input max-w-[10rem]" value={p.handicapClass} onChange={(e) => update(p.id, { handicapClass: e.target.value })}>
              {(Object.keys(CLASS_LABELS) as HandicapClass[]).map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
            <span className="text-sm text-fairway-500">hcp {p.handicap}</span>
            <select className="input max-w-[10rem]" value={p.role} onChange={(e) => update(p.id, { role: e.target.value })}>
              <option value="PLAYER">Player</option>
              <option value="TOURNAMENT_ADMIN">Tournament admin</option>
            </select>
            <button className="ml-auto text-sm text-red-600" onClick={() => remove(p.id)}>Remove</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 pt-2">
        <div>
          <label className="label">Add player</label>
          <input className="input max-w-[12rem]" placeholder="Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </div>
        <select className="input max-w-[10rem]" value={form.handicapClass} onChange={(e) => setForm({ ...form, handicapClass: e.target.value as HandicapClass })}>
          {(Object.keys(CLASS_LABELS) as HandicapClass[]).map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
        </select>
        <button className="btn-primary" disabled={!form.displayName}>Add</button>
      </form>
      <Err msg={error} />
    </section>
  );
}

function CoursesSection({ id, courses, onChanged }: { id: string; courses: Course[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Courses</h2>
      <ul className="text-sm">
        {courses.map((c) => (
          <li key={c.id} className="flex justify-between border-b border-fairway-50 py-1">
            <span className="font-semibold">{c.name}</span>
            <span className="text-fairway-500">{c.holes.length} holes</span>
          </li>
        ))}
        {courses.length === 0 && <li className="text-fairway-500">No courses yet.</li>}
      </ul>
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add course"}</button>
      {open && <CourseEditor tournamentId={id} onCreated={() => { setOpen(false); onChanged(); }} />}
    </section>
  );
}

function RoundsSection({ id, state, courses, onChanged }: { id: string; state: TournamentState; courses: Course[]; onChanged: () => void }) {
  const [form, setForm] = useState({ roundNumber: 1, name: "", courseId: "", holeNumbers: [] as number[] });
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/tournaments/${id}/rounds`, { ...form, type: "SCRAMBLE" });
      setForm({ roundNumber: form.roundNumber + 1, name: "", courseId: form.courseId, holeNumbers: [] });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create round");
    }
  }

  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);

  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Rounds</h2>
      <div className="space-y-3">
        {state.rounds.map((r) => (
          <RoundCard key={r.roundId} id={id} round={r} players={state.players} onChanged={onChanged} />
        ))}
      </div>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-t border-fairway-100 pt-3">
        <div>
          <label className="label">#</label>
          <input className="input w-16" type="number" value={form.roundNumber} onChange={(e) => setForm({ ...form, roundNumber: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input max-w-[10rem]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Round 1" />
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input max-w-[10rem]" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">—</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost" onClick={() => setForm({ ...form, holeNumbers: front })}>Front 9</button>
          <button type="button" className="btn-ghost" onClick={() => setForm({ ...form, holeNumbers: back })}>Back 9</button>
        </div>
        <span className="text-xs text-fairway-500">{form.holeNumbers.length} holes</span>
        <button className="btn-primary" disabled={!form.name || !form.courseId || form.holeNumbers.length === 0}>Create round</button>
      </form>
      <Err msg={error} />
    </section>
  );
}

function RoundCard({ id, round, players, onChanged }: { id: string; round: RoundComputation; players: PlayerLite[]; onChanged: () => void }) {
  const [showPairings, setShowPairings] = useState(false);
  const { data, mutate: mutateTeams } = useSWR<{ teams: TeamWithMembers[] }>(
    showPairings ? `/api/tournaments/${id}/rounds/${round.roundId}/teams` : null,
    fetcher,
  );

  async function patch(data: Record<string, unknown>) {
    await api.patch(`/api/tournaments/${id}/rounds/${round.roundId}`, data);
    onChanged();
  }

  const ld = round.achievements.find((a) => a.type === "LONGEST_DRIVE");
  const ctp = round.achievements.find((a) => a.type === "CLOSEST_TO_PIN");
  const par5Holes = round.holes.filter((h) => h.par === 5);
  const par3Holes = round.holes.filter((h) => h.par === 3);

  return (
    <div className="rounded-lg ring-1 ring-fairway-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">R{round.roundNumber} · {round.name}</span>
        <span className="rounded bg-fairway-100 px-2 py-0.5 text-xs">{round.type}</span>
        <select className="input max-w-[9rem]" value={round.status} onChange={(e) => patch({ status: e.target.value })}>
          {["PENDING", "ACTIVE", "COMPLETE"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-ghost" onClick={() => setShowPairings((o) => !o)}>{showPairings ? "Hide" : "Pairings"}</button>
      </div>

      {round.type === "SCRAMBLE" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-fairway-600">
            🚀 Longest Drive hole (par 5)
            <select className="input mt-1" value={ld?.holeNumber ?? ""} onChange={(e) => patch({ longestDriveHole: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None</option>
              {(par5Holes.length ? par5Holes : round.holes).map((h) => <option key={h.number} value={h.number}>Hole {h.number} (par {h.par})</option>)}
            </select>
          </label>
          <label className="text-xs text-fairway-600">
            🎯 Closest to Pin hole (par 3)
            <select className="input mt-1" value={ctp?.holeNumber ?? ""} onChange={(e) => patch({ closestToPinHole: e.target.value ? Number(e.target.value) : null })}>
              <option value="">None</option>
              {(par3Holes.length ? par3Holes : round.holes).map((h) => <option key={h.number} value={h.number}>Hole {h.number} (par {h.par})</option>)}
            </select>
          </label>
        </div>
      )}

      {showPairings && data && (
        <div className="mt-3">
          <RoundPairings
            tournamentId={id}
            roundId={round.roundId}
            players={players}
            existingTeams={data.teams}
            onSaved={() => { mutateTeams(); onChanged(); }}
          />
        </div>
      )}
    </div>
  );
}

function PlayoffSection({ id, state, courses, onChanged }: { id: string; state: TournamentState; courses: Course[]; onChanged: () => void }) {
  const [courseId, setCourseId] = useState("");
  const [holeNumbers, setHoleNumbers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/tournaments/${id}/playoff`, { courseId, holeNumbers });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);

  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Playoff round</h2>
      <p className="text-sm text-fairway-600">
        Seeds players by current points and pairs 1v2, 3v4, 5v6, 7v8 for a stroke-play playoff (handicaps still apply).
        A pair&apos;s winner takes the higher of its two positions. Regenerating re-seeds from the latest standings.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Course</label>
          <select className="input max-w-[10rem]" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">—</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost" onClick={() => setHoleNumbers(front)}>Front 9</button>
          <button type="button" className="btn-ghost" onClick={() => setHoleNumbers(back)}>Back 9</button>
        </div>
        <span className="text-xs text-fairway-500">{holeNumbers.length} holes</span>
        <button className="btn-primary" disabled={busy || !courseId || holeNumbers.length === 0} onClick={generate}>
          Generate / re-seed playoff
        </button>
      </div>
      <Err msg={error} />
    </section>
  );
}
