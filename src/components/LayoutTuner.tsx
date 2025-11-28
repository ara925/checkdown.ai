import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLayoutSettings, measureVerticalGap } from "@/lib/layout/LayoutSettings";
import { useToast } from "@/hooks/use-toast";

export default function LayoutTuner({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { settings, update, reset, undo, redo, canUndo, canRedo } = useLayoutSettings();
  const { toast } = useToast();
  const [threshold, setThreshold] = useState(settings.groupThresholdMinutes);
  const [gap, setGap] = useState(settings.messageGapPx);
  const [padX, setPadX] = useState(settings.bubblePaddingX);
  const [padY, setPadY] = useState(settings.bubblePaddingY);
  const [maxPct, setMaxPct] = useState(settings.bubbleMaxWidthPct);
  const [radius, setRadius] = useState(settings.bubbleRadiusPx);
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [overlayAlpha, setOverlayAlpha] = useState(0.35);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => { if (open) {
    const el = document.querySelector('[data-chat-scroll]') as HTMLElement | null;
    containerRef.current = el || null;
  } }, [open]);

  const applyAll = () => {
    update({
      groupThresholdMinutes: threshold,
      messageGapPx: gap,
      bubblePaddingX: padX,
      bubblePaddingY: padY,
      bubbleMaxWidthPct: maxPct,
      bubbleRadiusPx: radius,
    });
    toast({ title: "Layout updated", description: "Changes applied instantly and persisted" });
  };

  const runVisualCheck = () => {
    const container = containerRef.current; if (!container) return;
    const gaps = measureVerticalGap(container, '[data-chat-message]');
    const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
    const diff = Math.abs(avg - settings.messageGapPx);
    toast({ title: `Visual check: ${diff <= 1 ? 'PASS' : 'WARN'}`, description: `Avg gap ${avg}px vs setting ${settings.messageGapPx}px` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Layout tuning</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <TooltipProvider>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Grouping threshold (minutes)</label>
                </TooltipTrigger>
                <TooltipContent>Starts a new header when time gap exceeds this.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Message gap (px)</label>
                </TooltipTrigger>
                <TooltipContent>Vertical space between consecutive messages.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={0} value={gap} onChange={e => setGap(Number(e.target.value))} />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Bubble padding X (px)</label>
                </TooltipTrigger>
                <TooltipContent>Horizontal bubble padding.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={0} value={padX} onChange={e => setPadX(Number(e.target.value))} />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Bubble padding Y (px)</label>
                </TooltipTrigger>
                <TooltipContent>Vertical bubble padding.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={0} value={padY} onChange={e => setPadY(Number(e.target.value))} />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Bubble max width (%)</label>
                </TooltipTrigger>
                <TooltipContent>Max width of message bubbles.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={40} max={90} value={maxPct} onChange={e => setMaxPct(Number(e.target.value))} />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="text-sm">Bubble radius (px)</label>
                </TooltipTrigger>
                <TooltipContent>Corner roundness of bubbles.</TooltipContent>
              </Tooltip>
              <Input type="number" step={1} min={0} value={radius} onChange={e => setRadius(Number(e.target.value))} />
            </div>
          </TooltipProvider>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => setOverlaySrc(String(reader.result)); reader.readAsDataURL(f);
            }} />
            <Input type="number" step={0.05} min={0} max={1} value={overlayAlpha} onChange={e => setOverlayAlpha(Number(e.target.value))} />
            <Button variant="outline" onClick={runVisualCheck}>Measure gaps</Button>
          </div>
          {overlaySrc && (
            <div className="relative">
              <img src={overlaySrc} alt="reference" style={{ opacity: overlayAlpha }} className="w-full border rounded" />
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={undo} disabled={!canUndo}>Undo</Button>
            <Button variant="outline" onClick={redo} disabled={!canRedo}>Redo</Button>
            <Button variant="outline" onClick={reset}>Reset defaults</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={applyAll}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}