"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Leaderboard" },
  { slug: "scorecard", label: "Scorecard" },
  { slug: "chat", label: "Chat" },
  { slug: "admin", label: "Admin" },
];

export default function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const base = `/tournaments/${id}`;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-fairway-100">
        {TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = tab.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <Link key={tab.slug} href={href} className={`tab ${active ? "tab-active" : ""}`}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
