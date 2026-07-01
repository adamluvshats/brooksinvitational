"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await api.post<{ ok: boolean; token?: string }>("/api/auth/request-reset", { email });
      // In non-production the token is returned directly (no mail provider wired up).
      if (res.token) {
        setToken(res.token);
        setMsg("Reset token generated below (dev mode). Set a new password.");
      } else {
        setMsg("If that email exists, a reset link has been sent.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/auth/reset", { token, password });
      setMsg("Password updated — you can now log in.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Reset password</h1>
      <form onSubmit={request} className="card space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn-ghost w-full">Request reset token</button>
      </form>
      <form onSubmit={reset} className="card space-y-3">
        <div>
          <label className="label">Reset token</label>
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full">Set new password</button>
      </form>
      {msg && <p className="text-sm text-fairway-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-center text-sm"><Link href="/login" className="underline">Back to login</Link></p>
    </div>
  );
}
