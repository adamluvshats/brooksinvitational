"use client";

import { use, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher, api } from "@/lib/client";
import { useTournamentState } from "@/lib/useTournament";
import { useMe } from "@/lib/useMe";
import type { ChatMessageDto, PlayerLite } from "@/lib/types";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useTournamentState(id, 8000);
  const { me } = useMe();
  const { data, mutate } = useSWR<{ messages: ChatMessageDto[] }>(
    `/api/tournaments/${id}/chat`,
    fetcher,
    { refreshInterval: 3000 },
  );

  const players = state?.players ?? [];
  const [body, setBody] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Players whose "@DisplayName" appears in the draft become mentions on send.
  const mentionMatches = useMemo(() => {
    return players.filter((p) => body.includes("@" + p.displayName));
  }, [body, players]);

  const partial = useMemo(() => {
    const m = /@([\w. -]*)$/.exec(body);
    return m ? m[1].toLowerCase() : null;
  }, [body]);

  const suggestions =
    partial !== null
      ? players.filter((p) => p.displayName.toLowerCase().includes(partial)).slice(0, 6)
      : [];

  function pick(p: PlayerLite) {
    setBody((b) => b.replace(/@([\w. -]*)$/, "@" + p.displayName + " "));
    setSuggestOpen(false);
    taRef.current?.focus();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await api.post(`/api/tournaments/${id}/chat`, {
      body: body.trim(),
      mentionPlayerIds: mentionMatches.map((p) => p.id),
    });
    setBody("");
    await mutate();
  }

  const messages = data?.messages ?? [];

  if (!me) return <p className="text-fairway-600">Log in to join the smack talk.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex h-[60vh] flex-col-reverse overflow-y-auto">
        <div className="space-y-3">
          {messages.length === 0 && <p className="text-sm text-fairway-500">No messages yet — start talking.</p>}
          {messages.map((m) => {
            const mentionsMe = m.mentions.some((x) => players.find((p) => p.id === x.player.id)?.userId === me.id);
            return (
              <div key={m.id} className={`rounded-lg p-2 ${mentionsMe ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-fairway-800">{m.user.displayName}</span>
                  <span className="text-xs text-fairway-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{renderBody(m.body, m.mentions.map((x) => x.player.displayName))}</p>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={send} className="card relative space-y-2">
        {suggestOpen && suggestions.length > 0 && (
          <ul className="absolute bottom-full left-4 mb-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-fairway-200">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pick(p)} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-fairway-50">
                  @{p.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={taRef}
          className="input min-h-[70px]"
          placeholder="Talk some smack… use @ to tag a player"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSuggestOpen(/@([\w. -]*)$/.test(e.target.value));
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-fairway-500">
            {mentionMatches.length > 0 ? `Tagging: ${mentionMatches.map((p) => p.displayName).join(", ")}` : "No tags"}
          </span>
          <button className="btn-primary" disabled={!body.trim()}>Send</button>
        </div>
      </form>
    </div>
  );
}

/** Bold any "@DisplayName" tokens that match a mentioned player. */
function renderBody(body: string, names: string[]) {
  if (names.length === 0) return body;
  // Build a regex that matches @ + any of the mentioned display names.
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp("(@(?:" + escaped.join("|") + "))", "g");
  const parts = body.split(re);
  return parts.map((part, i) =>
    part.startsWith("@") && names.includes(part.slice(1)) ? (
      <span key={i} className="font-semibold text-fairway-700">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
