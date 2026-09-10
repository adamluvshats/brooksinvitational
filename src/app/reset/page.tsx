"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";

function ResetForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the token when arriving from an emailed reset link.
  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
      setMsg("Enter a new password to finish resetting your account.");
    }
  }, [searchParams]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const res = await api.post<{ ok: boolean; token?: string }>("/api/auth/request-reset", { email });
      if (res.token) {
        // Dev mode only (no mail provider configured).
        setToken(res.token);
        setMsg("Dev mode: reset token filled in below. Set a new password.");
      } else {
        setMsg("If that email is registered, a reset link is on its way.");
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
        <button className="btn-ghost w-full">Email me a reset link</button>
      </form>
      <form onSubmit={reset} className="card space-y-3">
        <div>
          <label className="label">Reset token</label>
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="From your email link" />
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

export default function ResetPage() {
  return (
    <Suspense fallback={<p className="text-fairway-600">Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
