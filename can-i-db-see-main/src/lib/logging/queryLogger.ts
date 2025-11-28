import type { QueryClient } from "@tanstack/react-query";

function isEnabled(): boolean {
  try {
    const ls = typeof window !== "undefined" ? window.localStorage.getItem("DEBUG_LOGGING") : null;
    const env = (import.meta as any)?.env?.VITE_DEBUG_LOGGING === "true";
    return ls === "true" || env === true;
  } catch {
    return false;
  }
}

export function initQueryLogging(queryClient: QueryClient) {
  if (!isEnabled()) return;
  queryClient.getQueryCache().subscribe((event) => {
    const q = (event as unknown as { query?: { queryKey?: unknown[]; state?: any } }).query;
    const key = q?.queryKey;
    const state = q?.state;
    const status = state?.status;
    const dataUpdatedAt = state?.dataUpdatedAt;
    const error = state?.error;
    console.debug("query-event", { type: (event as any).type, key, status, dataUpdatedAt, error });
    appendQuery({ ts: Date.now(), type: (event as any).type, key, status, error });
  });
}
import { appendQuery } from "./store";