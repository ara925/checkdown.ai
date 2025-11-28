import { useOnboarding } from "@/lib/onboarding/Onboarding";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function OnboardingTour() {
  const { steps, stepIndex, isOpen, next, back, skip, complete } = useOnboarding();
  const step = steps[stepIndex];
  const total = steps.length;
  const isLast = stepIndex === total - 1;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent aria-label="Onboarding Tour" className="sm:max-w-md animate-in fade-in-50 zoom-in-90" role="dialog">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Step {stepIndex + 1} of {total}</div>
          <h2 className="text-xl font-semibold">{step.title}</h2>
          <p className="text-sm">{step.description}</p>
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" aria-label="Skip tour" onClick={skip}>Skip Tour</Button>
            <div className="flex gap-2">
              <Button variant="outline" aria-label="Back" disabled={stepIndex === 0} onClick={back}>Back</Button>
              <Button aria-label={isLast ? "Finish" : "Next"} onClick={isLast ? complete : next}>
                {isLast ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
          <div className="flex gap-1" aria-label="Progress" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={total}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded ${i <= stepIndex ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}