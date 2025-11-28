import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSessionSetup } from "@/hooks/useSessionSetup";
import { Shield, User, Crown, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: number;
  name: string | null;
  email: string;
  organization_id: number | null;
  department_id: number | null;
}

interface UserRole {
  role: string;
}

interface UserWithRole extends User {
  user_roles: UserRole[];
}

interface Department {
  id: number;
  name: string;
}

interface JoinRequest {
  id: number;
  user_id: number;
  status: string;
  requested_at: string;
  users: {
    name: string | null;
    email: string;
  } | null;
}

function TeamMembersPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();
  
  useSessionSetup();

  useEffect(() => {
    fetchCurrentUserRole();
    fetchData();
  }, []);

  const fetchCurrentUserRole = async () => {
    const userData = localStorage.getItem("user");
    if (!userData) return;

    try {
      const user = JSON.parse(userData);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", user.organization_id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentUserRole(data.role);
      }
    } catch (error: any) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchData = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) {
        throw new Error("No user data found");
      }

      const user = JSON.parse(userData);

      // Ensure session is set up before querying
      if (user.organization_id) {
        await supabase.rpc('set_session_variables', {
          _user_id: user.id,
          _organization_id: user.organization_id,
          _department_id: user.department_id || null,
          _role: user.role || 'member'
        });
      }

      const [usersResponse, deptResponse, requestsResponse] = await Promise.all([
        supabase
          .from("users")
          .select(`
            *,
            user_roles!inner(role)
          `)
          .eq("organization_id", user.organization_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("departments")
          .select("*")
          .eq("organization_id", user.organization_id)
          .order("name"),
        supabase
          .from("organization_join_requests")
          .select("*, users!organization_join_requests_user_id_fkey(name, email)")
          .eq("organization_id", user.organization_id)
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
      ]);

      if (usersResponse.error) throw usersResponse.error;
      if (deptResponse.error) throw deptResponse.error;

      setUsers(usersResponse.data || []);
      setDepartments(deptResponse.data || []);
      setJoinRequests(requestsResponse.data || []);
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

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user data found");

      const currentUser = JSON.parse(userData);

      // Delete existing role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", currentUser.organization_id);

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: userId,
          organization_id: currentUser.organization_id,
          role: newRole as 'owner' | 'admin' | 'member' | 'manager',
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDepartmentChange = async (userId: number, departmentId: number | null) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ department_id: departmentId })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department updated successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'manager':
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'owner':
        return "default";
      case 'admin':
        return "secondary";
      case 'manager':
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    try {
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user data found");
      const currentUser = JSON.parse(userData);

      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email: inviteEmail,
          role: inviteRole,
          organizationId: currentUser.organization_id,
          invitedBy: currentUser.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleApproveRequest = async (requestId: number, userId: number) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const user = JSON.parse(userData);

      // 1. Update user's organization_id
      const { error: userError } = await supabase
        .from("users")
        .update({ organization_id: user.organization_id })
        .eq("id", userId);

      if (userError) throw userError;

      // 2. Create user_roles entry (default to 'member')
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          organization_id: user.organization_id,
          role: "member",
        });

      if (roleError) throw roleError;

      // 3. Update request status
      const { error: requestError } = await supabase
        .from("organization_join_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      toast({
        title: "Request Approved",
        description: "User has been added to your organization",
      });

      // Refresh data
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const user = JSON.parse(userData);

      const { error } = await supabase
        .from("organization_join_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: "The join request has been rejected",
      });

      // Refresh data
      fetchData();
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

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin';
  const isManager = currentUserRole === 'manager';
  const canManageRoles = isOwner || isAdmin;
  const canManageDepartments = isOwner || isAdmin;
  const canManage = isOwner || currentUserRole === 'admin' || currentUserRole === 'manager';

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {joinRequests.length > 0 && isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Join Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {joinRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{req.users?.name || req.users?.email || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">{req.users?.email || 'No email'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveRequest(req.id, req.user_id)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)}>Reject</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Members</h1>
            <p className="text-muted-foreground mt-1">
              Manage roles and departments for all organization members
              {!canManage && " (View only - Privileged role required)"}
            </p>
          </div>
          
          {(isOwner || isAdmin) && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInviteMember} disabled={inviting}>
                    {inviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-4">
          {users.map((user) => {
            const userRole = user.user_roles[0]?.role || 'member';
            return (
              <Card key={user.id} className="p-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {user.name || "Unknown"}
                      </p>
                      <Badge variant={getRoleBadgeVariant(userRole)} className="gap-1">
                        {getRoleIcon(userRole)}
                        {userRole}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap">
                      {canManageRoles && (
                        <Select
                          value={userRole}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={(userRole === 'owner' && !isOwner)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                    <Select
                      value={user.department_id?.toString() || "none"}
                      onValueChange={(value) =>
                        handleDepartmentChange(user.id, value === "none" ? null : parseInt(value))
                      }
                      disabled={!canManageDepartments}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="No Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Department</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function TeamMembers() {
  return (
    <ProtectedRoute>
      <TeamMembersPage />
    </ProtectedRoute>
  );
}
