import { useShortcuts } from "@/lib/shortcuts/ShortcutProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const actions = [
  { id: "app.openShortcuts", label: "Open shortcuts" },
  { id: "app.search", label: "Search" },
  { id: "chat.send", label: "Send message" },
  { id: "chat.jumpLatest", label: "Jump to latest" },
  { id: "chat.markUnread", label: "Mark unread" },
  { id: "chat.toggleEmoji", label: "Toggle emoji picker" },
  { id: "chat.toggleGif", label: "Toggle GIF picker" },
];

export default function ShortcutHelp() {
  const s = useShortcuts();
  return (
    <Dialog open={s.isHelpOpen} onOpenChange={(v) => (v ? s.openHelp() : s.closeHelp())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {actions.map(a => (
            <div key={a.id} className="flex items-center gap-3">
              <div className="w-48 text-sm text-muted-foreground">{a.label}</div>
              <Input
                value={s.get(a.id)}
                onChange={(e) => s.set(a.id, e.target.value)}
                onKeyDown={(e) => {
                  e.preventDefault();
                  const parts: string[] = [];
                  if (e.ctrlKey) parts.push("Ctrl");
                  if (e.altKey) parts.push("Alt");
                  if (e.shiftKey) parts.push("Shift");
                  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                  parts.push(k);
                  const combo = parts.join("+");
                  s.set(a.id, combo);
                }}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}