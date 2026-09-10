"use client";

import useSWR from "swr";
import { fetcher } from "./client";
import type { TournamentState } from "./types";

/** Live tournament state, polled every few seconds so all groups stay in sync. */
export function useTournamentState(id: string, refreshMs = 4000) {
  const { data, error, isLoading, mutate } = useSWR<TournamentState>(
    id ? `/api/tournaments/${id}` : null,
    fetcher,
    { refreshInterval: refreshMs },
  );
  return { state: data ?? null, error, isLoading, mutate };
}
