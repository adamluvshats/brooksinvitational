"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { useMe } from "@/lib/useMe";

export default function LoginPage() {
  const router = useRouter();
  const { mutate } = useMe();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/login", { username, password });
      await mutate();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Log in"}</button>
        <p className="text-center text-sm text-fairway-700">
          No account? <Link href="/register" className="font-semibold underline">Sign up</Link>
        </p>
        <p className="text-center text-xs text-fairway-600">
          <Link href="/reset" className="underline">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}
