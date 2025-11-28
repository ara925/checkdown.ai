import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type LayoutSettingsState = {
  groupThresholdMinutes: number;
  messageGapPx: number;
  bubblePaddingX: number;
  bubblePaddingY: number;
  bubbleMaxWidthPct: number;
  bubbleRadiusPx: number;
};

const DEFAULTS: LayoutSettingsState = {
  groupThresholdMinutes: 5,
  messageGapPx: 6,
  bubblePaddingX: 12,
  bubblePaddingY: 6,
  bubbleMaxWidthPct: 72,
  bubbleRadiusPx: 16,
};

type HistoryEntry = { prev: LayoutSettingsState; next: LayoutSettingsState };

const LayoutSettingsContext = createContext({
  settings: DEFAULTS as LayoutSettingsState,
  update: (partial: Partial<LayoutSettingsState>) => {},
  reset: () => {},
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
});

export const LayoutSettingsProvider = ({ children }: { children: any }) => {
  const [settings, setSettings] = useState<LayoutSettingsState>(() => {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem("layout_settings") || "{}") || {}) }; } catch { return DEFAULTS; }
  });
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const lastUpdate = useRef<LayoutSettingsState>(settings);

  useEffect(() => { localStorage.setItem("layout_settings", JSON.stringify(settings)); }, [settings]);

  const update = useCallback((partial: Partial<LayoutSettingsState>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      setUndoStack(stk => [...stk, { prev, next }]);
      setRedoStack([]);
      lastUpdate.current = next;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(prev => {
      const next = DEFAULTS;
      setUndoStack(stk => [...stk, { prev, next }]);
      setRedoStack([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack(stk => {
      if (stk.length === 0) return stk;
      const entry = stk[stk.length - 1];
      setSettings(entry.prev);
      setRedoStack(rs => [...rs, entry]);
      return stk.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(rs => {
      if (rs.length === 0) return rs;
      const entry = rs[rs.length - 1];
      setSettings(entry.next);
      setUndoStack(stk => [...stk, entry]);
      return rs.slice(0, -1);
    });
  }, []);

  const value = useMemo(() => ({ settings, update, reset, undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }), [settings, update, reset, undo, redo, undoStack.length, redoStack.length]);

  return (
    <LayoutSettingsContext.Provider value={value}>
      {children}
    </LayoutSettingsContext.Provider>
  );
};

export const useLayoutSettings = () => useContext(LayoutSettingsContext);

// Visual checks helpers
export const measureVerticalGap = (container: HTMLElement, selector: string) => {
  const nodes = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  const gaps: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1].getBoundingClientRect();
    const b = nodes[i].getBoundingClientRect();
    gaps.push(Math.max(0, Math.round(b.top - a.bottom)));
  }
  return gaps;
};