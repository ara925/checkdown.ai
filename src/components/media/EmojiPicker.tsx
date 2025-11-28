import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const toneChars = ["🏻","🏼","🏽","🏾","🏿"];
const categories: Record<string, string[]> = {
  Smileys: ["😀","😃","😄","😁","😆","😅","😂","🙂","🙃","😉","😊","😇","🥰","😍","😘","😗","😙","😚","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","🤪","😝","🤧","🥵","🥶"],
  People: ["👋","🤚","✋","🖐️","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🙏","💪","👶","👧","🧒","👦","👩","🧑","👨"],
  Animals: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🦄"],
  Food: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥔","🥕","🌽","🌶️","🥒"],
  Activities: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🥋","🎽","🛹","⛳","🎣"],
  Travel: ["✈️","🚗","🚕","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","🛩️","🛫","🛬"],
  Objects: ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","💽","💾","📼","📷","📸","📹","🎥","📟","📞","☎️","📠","📺","🎙️","🎚️"],
  Symbols: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","🔰","⭕","✅","❌","➕","➖"],
  Flags: ["🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🇺🇸","🇬🇧","🇨🇦","🇮🇳","🇯🇵","🇰🇷","🇩🇪","🇫🇷","🇪🇸","🇮🇹"]
};

export default function EmojiPicker({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (v: boolean) => void; onSelect: (emoji: string) => void; }) {
  const [q, setQ] = useState("");
  const [tone, setTone] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("Smileys");
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("emoji_recent") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("emoji_recent", JSON.stringify(recent.slice(0, 24))); }, [recent]);

  const list = useMemo(() => {
    const base = categories[tab] || [];
    const filtered = q.trim() ? base.filter(e => e.includes(q.trim())) : base;
    return filtered.map(e => {
      if (!tone) return e;
      const needsTone = /[\u{1F44B}-\u{1F9FF}]/u.test(e) || ["👋","👍","👎","✊","👊","👏","🙏","💪"].includes(e);
      return needsTone ? e + tone : e;
    });
  }, [q, tab, tone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <Input placeholder="Search emoji" value={q} onChange={e => setQ(e.target.value)} />
          <div className="flex items-center gap-1">
            {toneChars.map(t => (
              <button key={t} className={`px-2 py-1 rounded ${tone === t ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`} onClick={() => setTone(t)} aria-label="Skin tone">
                {t}
              </button>
            ))}
            <Button variant="outline" onClick={() => setTone(null)}>Default</Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2 overflow-x-auto">
          {Object.keys(categories).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`px-2 py-1 rounded ${tab === k ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{k}</button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-muted-foreground mb-1">Frequently used</div>
            <div className="grid grid-cols-8 gap-2">
              {recent.map(e => (
                <button key={e} className="text-2xl" onClick={() => { onSelect(e); setRecent([e, ...recent.filter(x => x !== e)]); }} aria-label="Select emoji">{e}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-8 gap-2">
          {list.map(e => (
            <button key={e} className="text-2xl" onClick={() => { onSelect(e); setRecent([e, ...recent.filter(x => x !== e)]); }} aria-label="Select emoji">{e}</button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}