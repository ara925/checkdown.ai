import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/useAuth";
import { setSessionVariables } from "@/hooks/useSessionSetup";
import { Building2, Users, Calendar, TrendingUp } from "lucide-react";

interface Organization {
  id: number;
  name: string;
  created_at: string;
}

interface Stats {
  totalMembers: number;
  totalTasks: number;
  totalMeetings: number;
  totalDepartments: number;
}

function OrganizationPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalTasks: 0,
    totalMeetings: 0,
    totalDepartments: 0,
  });
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [foundOrg, setFoundOrg] = useState<Organization | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const { user, supabaseUser } = useAuth();

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      if (!supabaseUser) {
        setLoading(false);
        return;
      }

      // Fetch the latest user data from the database using auth_user_id
      const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", supabaseUser.id)
        .single();
      
      if (userError) {
        console.error('Error fetching user:', userError);
        setLoading(false);
        return;
      }

      // Update localStorage with fresh data
      localStorage.setItem("user", JSON.stringify(userRecord));

      if (!userRecord.organization_id) {
        // User doesn't have an organization - show create form
        setLoading(false);
        return;
      }
      
      const organizationId = userRecord.organization_id;
      
      // Fetch organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgError) throw orgError;

      if (orgData) {
        setOrganization(orgData);
        setOrgName(orgData.name);

        // Fetch stats
        const [membersRes, tasksRes, meetingsRes, deptsRes] = await Promise.all([
          supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgData.id)
            .is("deleted_at", null),
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("meetings")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgData.id),
          supabase
            .from("departments")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgData.id),
        ]);

        setStats({
          totalMembers: membersRes.count || 0,
          totalTasks: tasksRes.count || 0,
          totalMeetings: meetingsRes.count || 0,
          totalDepartments: deptsRes.count || 0,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    
    setCreating(true);
    try {
      if (!supabaseUser) throw new Error("No authenticated user found");

      // Call edge function to create organization
      const { data, error } = await supabase.functions.invoke('create-organization', {
        body: {
          userId: supabaseUser.id,
          name: supabaseUser.user_metadata?.name || supabaseUser.email || '',
          email: supabaseUser.email || '',
          organizationName: newOrgName,
        },
      });

      if (error) throw error;
      if (data.error) {
        // Show a more user-friendly error message
        toast({
          title: "Organization Name Taken",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Organization created successfully",
      });

      // Refetch user data to get the updated organization_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', supabaseUser.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        // Fallback to reload if we can't fetch
        window.location.reload();
        return;
      }

      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(userData));

      // Set session variables with new organization_id
      await setSessionVariables();

      // Fetch the organization to display it
      setNewOrgName("");
      await fetchOrganization();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!organization || !orgName.trim()) return;

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });

      setEditing(false);
      fetchOrganization();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSearchOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Search for organization by exact name (case-insensitive)
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .ilike("name", searchQuery.trim())
        .limit(1);

      if (error) throw error;

      if (orgs && orgs.length > 0) {
        setFoundOrg(orgs[0]);
        
        // Check if user already has a pending request
        const { data: existingRequest } = await supabase
          .from("organization_join_requests")
          .select("*")
          .eq("user_id", user?.id)
          .eq("organization_id", orgs[0].id)
          .eq("status", "pending")
          .maybeSingle();

        setPendingRequest(existingRequest);
      } else {
        setFoundOrg(null);
        toast({
          title: "Not Found",
          description: "No organization found with that exact name",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleRequestToJoin = async () => {
    if (!foundOrg || !user?.id) return;

    try {
      const { error } = await supabase
        .from("organization_join_requests")
        .insert({
          user_id: user.id,
          organization_id: foundOrg.id,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Request Sent",
        description: `Your request to join ${foundOrg.name} has been sent`,
      });

      // Refresh to show pending status
      const { data: newRequest } = await supabase
        .from("organization_join_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", foundOrg.id)
        .single();

      setPendingRequest(newRequest);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!organization) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome to TrackSpot</h1>
            <p className="text-muted-foreground mt-2">
              Create a new organization or join an existing one to get started
            </p>
          </div>

          {/* Create Organization */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Enter your organization name"
                    className="mt-2"
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating || !newOrgName.trim()}>
                  {creating ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Join Organization */}
          <Card>
            <CardHeader>
              <CardTitle>Join Existing Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchOrganization} className="space-y-4">
                <div>
                  <Label htmlFor="searchOrg">Organization Name (exact match)</Label>
                  <Input
                    id="searchOrg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter exact organization name"
                    className="mt-2"
                  />
                </div>
                <Button type="submit" disabled={searching || !searchQuery.trim()}>
                  {searching ? "Searching..." : "Search"}
                </Button>
              </form>

              {foundOrg && !pendingRequest && (
                <div className="mt-4 p-4 border rounded-lg space-y-3">
                  <div>
                    <p className="font-medium">{foundOrg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(foundOrg.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button onClick={handleRequestToJoin}>
                    Request to Join
                  </Button>
                </div>
              )}

              {pendingRequest && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Request Pending</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your request to join {foundOrg?.name} is waiting for approval
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-muted-foreground">No organization found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Organization</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization settings and view overview
            </p>
          </div>
        </div>

        {/* Organization Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <div className="flex gap-2">
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!editing}
                  className="flex-1"
                />
                {editing ? (
                  <div className="flex gap-2">
                    <Button onClick={handleUpdate}>Save</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setOrgName(organization.name);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setEditing(true)}>Edit</Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(organization.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Members
                  </p>
                  <p className="text-3xl font-bold">{stats.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Tasks
                  </p>
                  <p className="text-3xl font-bold">{stats.totalTasks}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Meetings
                  </p>
                  <p className="text-3xl font-bold">{stats.totalMeetings}</p>
                </div>
                <Calendar className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Departments
                  </p>
                  <p className="text-3xl font-bold">{stats.totalDepartments}</p>
                </div>
                <Building2 className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function Organization() {
  return (
    <ProtectedRoute>
      <OrganizationPage />
    </ProtectedRoute>
  );
}
