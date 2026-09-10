"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { api } from "@/lib/client";

export function SiteHeader() {
  const { me, mutate } = useMe();
  const router = useRouter();

  async function logout() {
    await api.post("/api/auth/logout");
    await mutate();
    router.push("/login");
  }

  return (
    <header className="border-b border-fairway-200 bg-fairway-700 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">⛳</span>
          <span>Brooks Invitational</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {me ? (
            <>
              <span className="hidden sm:inline text-fairway-100">
                {me.displayName}
                {me.role === "ADMIN" && (
                  <span className="ml-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                    ADMIN
                  </span>
                )}
              </span>
              <button onClick={logout} className="rounded-md bg-fairway-600 px-3 py-1.5 font-semibold hover:bg-fairway-500">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Log in</Link>
              <Link href="/register" className="rounded-md bg-fairway-600 px-3 py-1.5 font-semibold hover:bg-fairway-500">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
