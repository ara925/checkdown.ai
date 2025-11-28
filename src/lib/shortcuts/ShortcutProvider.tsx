import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Combo = string;
type ActionId = string;

type ShortcutMap = Record<ActionId, Combo>;

const ShortcutContext = createContext({
  get: (id: ActionId) => "",
  set: (id: ActionId, combo: Combo) => {},
  on: (id: ActionId, handler: () => void) => {},
  off: (id: ActionId, handler: () => void) => {},
  openHelp: () => {},
  closeHelp: () => {},
  isHelpOpen: false,
});

const parseEvent = (e: KeyboardEvent) => {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(k);
  return parts.join("+");
};

export const ShortcutProvider = ({ children }: { children: any }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [map, setMap] = useState<ShortcutMap>(() => {
    try {
      const raw = localStorage.getItem("shortcuts_config");
      const base: ShortcutMap = {
        "app.openShortcuts": "Ctrl+/",
        "chat.send": "Ctrl+Enter",
        "chat.jumpLatest": "Ctrl+J",
        "chat.markUnread": "Ctrl+U",
        "chat.toggleEmoji": "Ctrl+E",
        "chat.toggleGif": "Ctrl+G",
        "app.search": "Ctrl+K",
        "app.openLayoutTuner": "Ctrl+L",
      };
      if (!raw) return base;
      const loaded = JSON.parse(raw);
      return { ...base, ...(loaded || {}) };
    } catch {
      return {
        "app.openShortcuts": "Ctrl+/",
        "chat.send": "Ctrl+Enter",
        "chat.jumpLatest": "Ctrl+J",
        "chat.markUnread": "Ctrl+U",
        "chat.toggleEmoji": "Ctrl+E",
        "chat.toggleGif": "Ctrl+G",
        "app.search": "Ctrl+K",
        "app.openLayoutTuner": "Ctrl+L",
      };
    }
  });

  const handlers = useMemo(() => new Map<ActionId, Set<() => void>>(), []);

  const get = useCallback((id: ActionId) => map[id] || "", [map]);
  const set = useCallback((id: ActionId, combo: Combo) => {
    setMap(prev => {
      const next = { ...prev, [id]: combo };
      localStorage.setItem("shortcuts_config", JSON.stringify(next));
      return next;
    });
  }, []);

  const on = useCallback((id: ActionId, handler: () => void) => {
    const s = handlers.get(id) || new Set();
    s.add(handler);
    handlers.set(id, s);
  }, [handlers]);

  const off = useCallback((id: ActionId, handler: () => void) => {
    const s = handlers.get(id);
    if (!s) return;
    s.delete(handler);
  }, [handlers]);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const combo = parseEvent(e);
      for (const [id, c] of Object.entries(map)) {
        if (c.toLowerCase() === combo.toLowerCase()) {
          const hs = handlers.get(id);
          if (hs && hs.size > 0) {
            e.preventDefault();
            hs.forEach(h => h());
          }
        }
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [map, handlers]);

  useEffect(() => {
    const open = () => setIsHelpOpen(true);
    on("app.openShortcuts", open);
    return () => off("app.openShortcuts", open);
  }, [on, off]);

  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  return (
    <ShortcutContext.Provider value={{ get: get as any, set, on, off, openHelp, closeHelp, isHelpOpen }}>
      {children}
    </ShortcutContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutContext);