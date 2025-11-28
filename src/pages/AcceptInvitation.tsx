import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Home, ArrowRight, Loader2 } from "lucide-react";

interface InvitationData {
  id: number;
  email: string;
  role: string;
  team_id: number;
  status: string;
  organizationName?: string;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingInvitation, setFetchingInvitation] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      toast({
        title: "Invalid invitation",
        description: "No invitation token provided.",
        variant: "destructive",
      });
      navigate('/sign-in');
      return;
    }

    const fetchInvitation = async () => {
      try {
        // Fetch invitation details
        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .select('id, email, role, team_id, status')
          .eq('token', token)
          .eq('status', 'pending')
          .single();

        if (inviteError || !invitation) {
          toast({
            title: "Invalid invitation",
            description: "This invitation link is invalid or has expired.",
            variant: "destructive",
          });
          navigate('/sign-in');
          return;
        }

        // Fetch organization name
        const { data: teamData } = await supabase
          .from('teams')
          .select('organizations(name)')
          .eq('id', invitation.team_id)
          .single();

        setInvitationData({
          ...invitation,
          organizationName: teamData?.organizations?.name || 'the team'
        });
      } catch (error) {
        console.error('Error fetching invitation:', error);
        toast({
          title: "Error",
          description: "Failed to load invitation details.",
          variant: "destructive",
        });
        navigate('/sign-in');
      } finally {
        setFetchingInvitation(false);
      }
    };

    fetchInvitation();
  }, [searchParams, toast, navigate]);

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitationData) return;

    setLoading(true);

    try {
      // Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.email,
        password,
        options: {
          emailRedirectTo: `https://checkdown.ai/dashboard`,
          data: {
            name,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Check if user already exists
      if (authData.user.identities && authData.user.identities.length === 0) {
        toast({
          title: "Account already exists",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/sign-in"), 2000);
        return;
      }

      // Accept the invitation
      const { error: acceptError } = await supabase.functions.invoke('accept-invitation', {
        body: {
          userId: authData.user.id,
          invitationId: invitationData.id,
          name,
          email: invitationData.email
        }
      });

      if (acceptError) {
        console.error('Failed to accept invitation:', acceptError);
        toast({
          title: "Account created but...",
          description: "There was an issue adding you to the organization. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome to the team!",
        description: `Your account has been created and you've been added to ${invitationData.organizationName}.`,
      });

      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      toast({
        title: "Failed to accept invitation",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitationData) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" style={{ top: "10%", right: "5%" }} />
        <div className="absolute w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ bottom: "10%", left: "5%", animationDelay: "2s" }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.05)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.05)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Home button */}
      <div className="absolute top-6 left-6 z-10">
        <Button asChild variant="ghost" className="text-foreground hover:text-primary">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Home
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-md glass-effect border-primary/20 relative z-10 animate-slide-in-up">
        <CardHeader className="text-center">
          <Link to="/" className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity inline-block mx-auto mb-4">
            Trackspot
          </Link>
          <CardTitle className="text-2xl">Join Your Team</CardTitle>
          <CardDescription>
            You've been invited to join <span className="font-semibold text-foreground">{invitationData.organizationName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitationData.email}
                disabled
                className="border-primary/20 bg-muted"
              />
              <p className="text-xs text-muted-foreground">This email was invited to join the organization</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="border-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-primary/20"
              />
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Accept Invitation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
