import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Item = { url: string; preview: string; type: "gif" | "mp4" | "webp" };

const saveData = typeof navigator !== "undefined" && (navigator as any).connection && (navigator as any).connection.saveData;

export default function GifPicker({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (v: boolean) => void; onSelect: (item: Item) => void; }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [pasteUrl, setPasteUrl] = useState("");
  const key = (import.meta as any).env?.VITE_TENOR_API_KEY || "";

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!key || !q.trim()) { setItems([]); return; }
      try {
        const u = new URL("https://tenor.googleapis.com/v2/search");
        u.searchParams.set("q", q.trim());
        u.searchParams.set("key", key);
        u.searchParams.set("limit", "24");
        const res = await fetch(u.toString());
        const json = await res.json();
        const arr: Item[] = (json.results || []).map((r: any) => {
          const f = r.media_formats || {};
          const tiny = saveData ? (f.tinymp4 || f.tinygif || f.tinywebm || f.tinywebp) : null;
          const best = f.mp4 || f.gif || f.webp || f.tinygif || f.tinymp4 || f.tinywebp;
          const t: Item = best?.url?.endsWith(".mp4") ? { url: best.url, preview: (tiny?.url || best.url), type: "mp4" } : best?.url?.endsWith(".webp") ? { url: best.url, preview: (tiny?.url || best.url), type: "webp" } : { url: best.url, preview: (tiny?.url || best.url), type: "gif" };
          return t;
        });
        if (!cancelled) setItems(arr);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [q, key]);

  const canSearch = !!key;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Input placeholder={canSearch ? "Search GIFs" : "Paste GIF/MP4/WebP URL"} value={canSearch ? q : pasteUrl} onChange={e => canSearch ? setQ(e.target.value) : setPasteUrl(e.target.value)} />
          {!canSearch && (
            <Button onClick={() => {
              const url = pasteUrl.trim();
              if (!url) return;
              const t: Item = url.endsWith(".mp4") ? { url, preview: url, type: "mp4" } : url.endsWith(".webp") ? { url, preview: url, type: "webp" } : { url, preview: url, type: "gif" };
              onSelect(t);
              setPasteUrl("");
              onOpenChange(false);
            }}>Add</Button>
          )}
        </div>
        {canSearch && (
          <div className="grid grid-cols-4 gap-3">
            {items.map(it => (
              <button key={it.url} className="rounded overflow-hidden" onClick={() => { onSelect(it); onOpenChange(false); }} aria-label="Select GIF">
                {it.type === "mp4" ? (
                  <video src={it.preview} muted playsInline className="w-full h-32 object-cover" />
                ) : (
                  <img src={it.preview} alt="GIF" className="w-full h-32 object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}