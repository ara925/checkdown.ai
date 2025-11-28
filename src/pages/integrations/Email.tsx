import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  email?: string;
}

function EmailPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<EmailProvider[]>([
    { id: "gmail", name: "Gmail", icon: "📧", connected: false },
    { id: "outlook", name: "Outlook/Hotmail", icon: "📨", connected: false },
  ]);

  const handleConnect = async (providerId: string) => {
    toast({
      title: "OAuth Integration Required",
      description: `${providerId === 'gmail' ? 'Gmail' : 'Outlook'} OAuth requires backend setup with Google/Microsoft APIs.`,
      variant: "default",
    });
  };

  const handleDisconnect = (providerId: string) => {
    setProviders(providers.map(p => 
      p.id === providerId ? { ...p, connected: false, email: undefined } : p
    ));
    toast({
      title: "Disconnected",
      description: `Your ${providerId === 'gmail' ? 'Gmail' : 'Outlook'} account has been disconnected.`,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Integration</h1>
          <p className="text-muted-foreground mt-1">
            Connect your email services to sync messages and manage communications
          </p>
        </div>

        <div className="grid gap-6">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{provider.icon}</div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {provider.name}
                        {provider.connected && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {provider.connected
                          ? provider.email || "Connected account"
                          : `Connect your ${provider.name} account`}
                      </CardDescription>
                    </div>
                  </div>
                  {provider.connected ? (
                    <Button
                      variant="outline"
                      onClick={() => handleDisconnect(provider.id)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button onClick={() => handleConnect(provider.id)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm">
                    <h4 className="font-medium mb-2">Features:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Read and send emails from within the app</li>
                      <li>• Sync email threads with tasks and meetings</li>
                      <li>• Automatic contact synchronization</li>
                      <li>• Real-time notifications for new messages</li>
                    </ul>
                  </div>
                  {!provider.connected && (
                    <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        OAuth integration requires backend configuration with {provider.name} API credentials.
                        Contact your administrator to enable this integration.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Sync Settings</CardTitle>
            <CardDescription>
              Configure how emails are synchronized with your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Email sync settings will be available once you connect an email provider.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function Email() {
  return (
    <ProtectedRoute>
      <EmailPage />
    </ProtectedRoute>
  );
}
