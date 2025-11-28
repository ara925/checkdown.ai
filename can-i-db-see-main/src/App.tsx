import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/lib/auth/useAuth";
import { QueryLoggingBridge } from "@/lib/logging/QueryLoggingBridge";
const Index = lazy(() => import("./pages/Index"));
import ShortcutHelp from "@/components/ShortcutHelp";
import { ShortcutProvider } from "@/lib/shortcuts/ShortcutProvider";
import { LayoutSettingsProvider } from "@/lib/layout/LayoutSettings";
import { OnboardingProvider } from "@/lib/onboarding/Onboarding";
import OnboardingTour from "@/components/OnboardingTour";
import HelpLauncher from "@/components/HelpLauncher";
import { CallProvider } from "@/contexts/CallContext";
import { IncomingCallListener } from "@/components/call/IncomingCallListener";
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Meetings = lazy(() => import("./pages/Meetings"));
const Chat = lazy(() => import("./pages/Chat"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const Departments = lazy(() => import("./pages/Departments"));
const Organization = lazy(() => import("./pages/Organization"));
const Activity = lazy(() => import("./pages/Activity"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Security = lazy(() => import("./pages/Security"));
const Settings = lazy(() => import("./pages/Settings"));
const Email = lazy(() => import("./pages/integrations/Email"));
const Harvest = lazy(() => import("./pages/integrations/Harvest"));
const Vault = lazy(() => import("./pages/integrations/Vault"));
const DevTools = lazy(() => import("./pages/DevTools"));
const CallPage = lazy(() => import("./pages/call/CallPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
      <QueryClientProvider client={queryClient}>
        <QueryLoggingBridge />
        <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CallProvider>
          <ShortcutProvider>
          <IncomingCallListener />
          <LayoutSettingsProvider>
          <OnboardingProvider>
          <Initializer />
          <ShortcutHelp />
          <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/team-members" element={<TeamMembers />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/organization" element={<Organization />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/security" element={<Security />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/integrations/email" element={<Email />} />
            <Route path="/integrations/harvest" element={<Harvest />} />
            <Route path="/integrations/vault" element={<Vault />} />
            <Route path="/devtools" element={<DevTools />} />
            <Route path="/call/:type/:roomKey" element={<CallPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <OnboardingTour />
          <HelpLauncher />
          </OnboardingProvider>
          </LayoutSettingsProvider>
          </ShortcutProvider>
          </CallProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

function Initializer() {
  useEffect(() => {
    const urlToUint8 = (base64: string) => {
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64Safe);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) { arr[i] = raw.charCodeAt(i); }
      return arr;
    };
    (async () => {
      try {
        if (!('serviceWorker' in navigator)) return;
        if (!('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.register('/sw.js');
        const { data } = await supabase.functions.invoke('get-vapid');
        const publicKey = data?.publicKey || '';
        if (!publicKey) return;
        const existing = await reg.pushManager.getSubscription();
        if (!existing) {
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlToUint8(publicKey) });
          const userData = localStorage.getItem('user');
          if (userData) {
            const me = JSON.parse(userData);
            const json = sub.toJSON();
            const keys = (json as any).keys || {};
            await ((supabase as any).from('push_subscriptions')).upsert({ user_id: me.id, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' });
          }
        }
      } catch {}
    })();
  }, []);
  return null;
}
