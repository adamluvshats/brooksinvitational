"use client";

import useSWR from "swr";
import { fetcher } from "./client";
import type { Me } from "./types";

export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<{ user: Me | null }>(
    "/api/auth/me",
    fetcher,
  );
  return { me: data?.user ?? null, isLoading, error, mutate };
}
