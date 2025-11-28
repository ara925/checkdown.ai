import { createContext, useContext, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Step = { id: string; title: string; description: string };

type OnboardingContextType = {
  steps: Step[];
  stepIndex: number;
  isOpen: boolean;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  start: () => void;
  canStart: boolean;
  completed: boolean;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const messages: Record<string, string> = {
  "onb.welcome.title": "Welcome",
  "onb.welcome.desc": "Explore key areas and learn how to get started.",
  "onb.dashboard.title": "Dashboard",
  "onb.dashboard.desc": "See recent activity and quick stats for your organization.",
  "onb.tasks.title": "Tasks",
  "onb.tasks.desc": "Create, track, and manage tasks with clear roles and states.",
  "onb.meetings.title": "Meetings",
  "onb.meetings.desc": "View and schedule meetings; link tasks for better follow-through.",
  "onb.chat.title": "Chat",
  "onb.chat.desc": "Send messages and collaborate with read receipts and reactions.",
  "onb.departments.title": "Departments",
  "onb.departments.desc": "Organize members into departments for clearer ownership.",
  "onb.finish.title": "Finish",
  "onb.finish.desc": "You’re all set. Use the help button anytime for page guidance.",
};

function t(key: string) { return messages[key] || key; }

function getUserKey() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "guest";
    const u = JSON.parse(raw);
    return String(u?.id || "guest");
  } catch { return "guest"; }
}

function useOnboardingSteps(): Step[] {
  return useMemo(() => [
    { id: "welcome", title: t("onb.welcome.title"), description: t("onb.welcome.desc") },
    { id: "dashboard", title: t("onb.dashboard.title"), description: t("onb.dashboard.desc") },
    { id: "tasks", title: t("onb.tasks.title"), description: t("onb.tasks.desc") },
    { id: "meetings", title: t("onb.meetings.title"), description: t("onb.meetings.desc") },
    { id: "chat", title: t("onb.chat.title"), description: t("onb.chat.desc") },
    { id: "departments", title: t("onb.departments.title"), description: t("onb.departments.desc") },
    { id: "finish", title: t("onb.finish.title"), description: t("onb.finish.desc") },
  ], []);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const steps = useOnboardingSteps();
  const [stepIndex, setStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const userKey = user?.id ? String(user.id) : "guest";
  const [completed, setCompleted] = useState(() => localStorage.getItem(`onboarding.completed:v1:${userKey}`) === "true");
  const canStart = !!user && !completed;

  const start = () => {
    if (!user || completed) return;
    setStepIndex(0);
    setIsOpen(true);
    try {
      if (user.team_id) {
        supabase.from("activity_logs").insert({
          team_id: user.team_id,
          organization_id: user.organization_id || null,
          user_id: user.id,
          action: "onboarding_tour_started",
          related_entity_type: "onboarding",
          related_entity_id: null,
        });
      }
    } catch {}
  };

  const next = () => {
    setStepIndex((i) => {
      const n = Math.min(steps.length - 1, i + 1);
      if (n === steps.length - 1) setIsOpen(true);
      return n;
    });
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));
  const skip = () => {
    const key = `onboarding.completed:v1:${userKey}`;
    localStorage.setItem(key, "true");
    setCompleted(true);
    setIsOpen(false);
    try {
      if (user && user.team_id) {
        supabase.from("activity_logs").insert({
          team_id: user.team_id,
          organization_id: user.organization_id || null,
          user_id: user.id,
          action: "onboarding_tour_skipped",
          related_entity_type: "onboarding",
          related_entity_id: null,
        });
      }
    } catch {}
  };
  const complete = () => {
    const key = `onboarding.completed:v1:${userKey}`;
    localStorage.setItem(key, "true");
    setCompleted(true);
    setIsOpen(false);
    try {
      if (user && user.team_id) {
        supabase.from("activity_logs").insert({
          team_id: user.team_id,
          organization_id: user.organization_id || null,
          user_id: user.id,
          action: "onboarding_tour_completed",
          related_entity_type: "onboarding",
          related_entity_id: null,
        });
      }
    } catch {}
  };

  return (
    <OnboardingContext.Provider value={{ steps, stepIndex, isOpen, next, back, skip, complete, start, canStart, completed }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("OnboardingContext not found");
  return ctx;
}