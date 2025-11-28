export type ConsoleLevel = "log" | "warn" | "error" | "info" | "debug";

export interface ConsoleEntry {
  ts: number;
  level: ConsoleLevel;
  args: unknown[];
}

export interface FetchEntry {
  ts: number;
  method: string;
  url: string;
  requestHeaders?: unknown;
  requestBody?: unknown;
  status?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  error?: unknown;
}

export interface ErrorEntry {
  ts: number;
  type: "window.error" | "unhandledrejection";
  data: unknown;
}

export interface QueryEntry {
  ts: number;
  type: string;
  key?: unknown[];
  status?: string;
  error?: unknown;
}

type Listener = (state: LogState) => void;

export interface LogState {
  console: ConsoleEntry[];
  fetch: FetchEntry[];
  errors: ErrorEntry[];
  queries: QueryEntry[];
}

const state: LogState = {
  console: [],
  fetch: [],
  errors: [],
  queries: [],
};

const listeners = new Set<Listener>();

function notify() {
  const snapshot: LogState = {
    console: [...state.console],
    fetch: [...state.fetch],
    errors: [...state.errors],
    queries: [...state.queries],
  };
  listeners.forEach((l) => l(snapshot));
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener({ ...state, console: [...state.console], fetch: [...state.fetch], errors: [...state.errors], queries: [...state.queries] });
  return () => listeners.delete(listener);
}

export function clear(category: keyof LogState) {
  state[category] = [] as any;
  notify();
}

export function appendConsole(entry: ConsoleEntry) {
  state.console.push(entry);
  if (state.console.length > 1000) state.console.shift();
  notify();
}

export function appendFetch(entry: FetchEntry) {
  state.fetch.push(entry);
  if (state.fetch.length > 1000) state.fetch.shift();
  notify();
}

export function appendError(entry: ErrorEntry) {
  state.errors.push(entry);
  if (state.errors.length > 1000) state.errors.shift();
  notify();
}

export function appendQuery(entry: QueryEntry) {
  state.queries.push(entry);
  if (state.queries.length > 1000) state.queries.shift();
  notify();
}

export function getState(): LogState {
  return {
    console: [...state.console],
    fetch: [...state.fetch],
    errors: [...state.errors],
    queries: [...state.queries],
  };
}