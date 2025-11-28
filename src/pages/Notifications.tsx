import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { setSessionVariables } from "@/hooks/useSessionSetup";
import { useAuth } from "@/lib/auth/useAuth";

function NotificationsPage() {
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        await setSessionVariables();
        if (!user) return;
        const { data } = await supabase
          .from('notification_settings')
          .select('sms_enabled, email_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setSmsEnabled((data.sms_enabled ?? 'false') === 'true');
          setEmailEnabled((data.email_enabled ?? 'true') === 'true');
        }
      } catch {}
    })();
  }, [user?.id]);

  const handleSave = async () => {
    try {
      await setSessionVariables();
      if (!user) return;
      await supabase
        .from('notification_settings')
        .upsert({ user_id: user.id, sms_enabled: smsEnabled ? 'true' : 'false', email_enabled: emailEnabled ? 'true' : 'false' }, { onConflict: 'user_id' });
      toast({ title: "Settings saved", description: "Your notification preferences have been updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save notification settings", variant: "destructive" });
    }
  };

  const sendTestPush = async () => {
    try {
      if (!user) return;
      const title = "Test Notification";
      const body = "This is a test push notification";
      const url = "/notifications";
      const { data, error } = await supabase.functions.invoke('notify-chat', {
        body: { targetUserId: user.id, title, body, url }
      });
      if (error) throw error;
      toast({ title: "Notification sent", description: "A test push notification was dispatched" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to send test notification", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Notification Settings</h1>
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={smsEnabled}
                  onCheckedChange={(checked) => setSmsEnabled(checked as boolean)}
                />
                <label className="font-medium">SMS Enabled</label>
              </div>
            </div>

            <div className="flex gap-3">
              <Input placeholder="SMS number (+1...)" className="flex-1" disabled={!smsEnabled} />
              <Button variant="outline" disabled={!smsEnabled}>
                Send test SMS
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={emailEnabled}
                  onCheckedChange={(checked) => setEmailEnabled(checked as boolean)}
                />
                <label className="font-medium">Email Enabled</label>
              </div>
            </div>

            <div className="flex gap-3">
              <Input placeholder="Notification email" className="flex-1" disabled={!emailEnabled} />
              <Button variant="outline" disabled={!emailEnabled}>
                Send test Email
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={pushEnabled}
                  onCheckedChange={(checked) => setPushEnabled(checked as boolean)}
                />
                <label className="font-medium">Push Enabled</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="-:- -" disabled={!pushEnabled} />
              <Input placeholder="-:- -" disabled={!pushEnabled} />
            </div>

            <Button variant="outline" className="w-full" disabled={!pushEnabled} onClick={sendTestPush}>
              Show test notification
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <label className="font-medium">Locale</label>
            <Select defaultValue="english">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">
            Save
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function Notifications() {
  return (
    <ProtectedRoute>
      <NotificationsPage />
    </ProtectedRoute>
  );
}
