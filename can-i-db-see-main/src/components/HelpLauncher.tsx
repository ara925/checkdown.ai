import { useLocation } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { useOnboarding } from "@/lib/onboarding/Onboarding";
import { supabase } from "@/integrations/supabase/client";

const helpTexts: Record<string, { title: string; content: string }> = {
  "/dashboard": { title: "Dashboard Help", content: "Overview of recent activity, tasks, and meetings. Use links to navigate." },
  "/tasks": { title: "Tasks Help", content: "Create and manage tasks. Use filters, bulk actions, and inline updates." },
  "/meetings": { title: "Meetings Help", content: "View and schedule meetings. Link tasks for follow-ups." },
  "/chat": { title: "Chat Help", content: "Message teammates, react to messages, and track read receipts." },
  "/departments": { title: "Departments Help", content: "Group members by department to clarify ownership and reporting." },
  "/team-members": { title: "Team Members Help", content: "Manage roles and view your organization's members." },
  "/activity": { title: "Activity Help", content: "Audit system actions across tasks, meetings, and departments." },
  "/organization": { title: "Organization Help", content: "Configure organization details and structure." },
  "/notifications": { title: "Notifications Help", content: "Configure your notification preferences and quiet hours." },
  "/security": { title: "Security Help", content: "Review and adjust security-related settings." },
  "/settings": { title: "Settings Help", content: "Update personal and application settings." },
};

export default function HelpLauncher() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const key = Object.keys(helpTexts).find((k) => pathname.startsWith(k)) || "/dashboard";
  const info = helpTexts[key];
  const { user } = useAuth();
  const { start, canStart } = useOnboarding();

  return (
    <div>
      <Button aria-label="Help" title="Help" className="fixed bottom-4 right-4 rounded-full h-10 w-10 shadow" variant="outline" onClick={async () => { setOpen(true); try { if (user && user.team_id) { await supabase.from("activity_logs").insert({ team_id: user.team_id, organization_id: user.organization_id || null, user_id: user.id, action: "help_opened", related_entity_type: "help", related_entity_id: null }); } } catch {} }}>
        <HelpCircle className="h-5 w-5" />
      </Button>
      {user && (
        <Button aria-label="Start Tour" title="Start Tour" className="fixed bottom-16 right-4 shadow" variant="default" onClick={async () => { start(); try { if (user.team_id) { await supabase.from("activity_logs").insert({ team_id: user.team_id, organization_id: user.organization_id || null, user_id: user.id, action: "onboarding_tour_triggered", related_entity_type: "onboarding", related_entity_id: null }); } } catch {} }} disabled={!canStart}>
          Start Tour
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-label="Help" role="dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{info.title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {info.content}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}