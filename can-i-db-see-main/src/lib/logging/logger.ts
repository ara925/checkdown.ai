let initialized = false;

function isEnabled(): boolean {
  try {
    const ls = typeof window !== "undefined" ? window.localStorage.getItem("DEBUG_LOGGING") : null;
    const env = (import.meta as any)?.env?.VITE_DEBUG_LOGGING === "true";
    return ls === "true" || env === true;
  } catch {
    return false;
  }
}

function wrapConsole() {
  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };
  const ts = () => new Date().toISOString();
  console.log = (...args: unknown[]) => {
    orig.log(`[${ts()}]`, ...args);
    appendConsole({ ts: Date.now(), level: "log", args });
  };
  console.warn = (...args: unknown[]) => {
    orig.warn(`[${ts()}]`, ...args);
    appendConsole({ ts: Date.now(), level: "warn", args });
  };
  console.error = (...args: unknown[]) => {
    orig.error(`[${ts()}]`, ...args);
    appendConsole({ ts: Date.now(), level: "error", args });
  };
  console.info = (...args: unknown[]) => {
    orig.info(`[${ts()}]`, ...args);
    appendConsole({ ts: Date.now(), level: "info", args });
  };
  console.debug = (...args: unknown[]) => {
    orig.debug(`[${ts()}]`, ...args);
    appendConsole({ ts: Date.now(), level: "debug", args });
  };
  window.addEventListener("error", (e) => {
    orig.error("window.error", {
      message: e.message,
      source: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
    appendError({ ts: Date.now(), type: "window.error", data: { message: e.message, source: e.filename, lineno: e.lineno, colno: e.colno } });
  });
  window.addEventListener("unhandledrejection", (e) => {
    orig.error("unhandledrejection", {
      reason: (e as PromiseRejectionEvent).reason,
    });
    appendError({ ts: Date.now(), type: "unhandledrejection", data: { reason: (e as PromiseRejectionEvent).reason } });
  });
}

function wrapFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const start = performance.now();
    const url = typeof input === "string" ? input : input.url;
    const method = init?.method || (typeof input !== "string" ? (input as Request).method : "GET") || "GET";
    const reqHeaders = init?.headers || (typeof input !== "string" ? (input as Request).headers : undefined);
    let reqHeadersObj: Record<string, string> | undefined = undefined;
    try {
      if (reqHeaders instanceof Headers) {
        reqHeadersObj = {};
        reqHeaders.forEach((v, k) => {
          const key = k.toLowerCase();
          if (key === "authorization" || key === "apikey") {
            reqHeadersObj[k] = "***";
          } else {
            reqHeadersObj[k] = v;
          }
        });
      } else if (Array.isArray(reqHeaders)) {
        reqHeadersObj = {};
        (reqHeaders as [string, string][]).forEach(([k, v]) => {
          const key = k.toLowerCase();
          reqHeadersObj![k] = key === "authorization" || key === "apikey" ? "***" : v;
        });
      } else if (reqHeaders && typeof reqHeaders === "object") {
        reqHeadersObj = {};
        Object.entries(reqHeaders as Record<string, string>).forEach(([k, v]) => {
          const key = k.toLowerCase();
          reqHeadersObj![k] = key === "authorization" || key === "apikey" ? "***" : v;
        });
      }
    } catch {}
    const reqBody = init?.body;
    appendFetch({ ts: Date.now(), method, url, requestHeaders: reqHeadersObj ?? undefined, requestBody: reqBody as any });
    console.groupCollapsed(`[fetch] ${method} ${url}`);
    console.log("request", { method, url, headers: reqHeadersObj ?? {}, body: reqBody });
    try {
      const res = await originalFetch(input as any, init);
      const clone = res.clone();
      const contentType = clone.headers.get("content-type") || "";
      let responseBody: unknown = null;
      try {
        if (contentType.includes("application/json")) {
          responseBody = await clone.json();
        } else {
          const text = await clone.text();
          responseBody = text.length > 20000 ? text.slice(0, 20000) : text;
        }
      } catch {
        responseBody = null;
      }
      const duration = Math.round(performance.now() - start);
      const headersObj: Record<string, string> = {};
      clone.headers.forEach((v, k) => {
        headersObj[k] = v;
      });
      console.log("response", { status: res.status, duration, headers: headersObj, body: responseBody });
      appendFetch({ ts: Date.now(), method, url, status: res.status, durationMs: duration, responseHeaders: headersObj, responseBody });
      console.groupEnd();
      return res;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      console.error("fetch-error", { err, url, method, duration });
      appendFetch({ ts: Date.now(), method, url, durationMs: duration, error: err });
      console.groupEnd();
      throw err;
    }
  };
}

function attachGlobal() {
  (window as any).__enableDebugLogging = () => {
    try {
      window.localStorage.setItem("DEBUG_LOGGING", "true");
    } catch {}
    activate();
  };
  (window as any).__disableDebugLogging = () => {
    try {
      window.localStorage.setItem("DEBUG_LOGGING", "false");
    } catch {}
  };
}

function activate() {
  if (initialized) return;
  initialized = true;
  wrapConsole();
  wrapFetch();
}

export function initLogging() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  attachGlobal();
  activate();
}
import { appendConsole, appendError, appendFetch } from "./store";