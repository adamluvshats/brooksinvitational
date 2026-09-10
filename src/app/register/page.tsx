"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { useMe } from "@/lib/useMe";

export default function RegisterPage() {
  const router = useRouter();
  const { mutate } = useMe();
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/register", form);
      await mutate();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Create an account</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Display name</label>
          <input className="input" value={form.displayName} onChange={set("displayName")} />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={form.username} onChange={set("username")} autoComplete="username" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Sign up"}</button>
        <p className="text-center text-sm text-fairway-700">
          Already have an account? <Link href="/login" className="font-semibold underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
