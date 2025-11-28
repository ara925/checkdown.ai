import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, CheckSquare, Calendar, TrendingUp, ArrowRight,
  CalendarPlus, PlusCircle, UserPlus, Settings, 
  CheckCircle2, CalendarDays, UserCircle, Zap, MoreVertical
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: number;
  title: string;
  state: string;
  assignee_id: number | null;
  deadline_at: string | null;
  description: string | null;
}

interface User {
  id: number;
  name: string | null;
  email: string;
}

interface Activity {
  id: number;
  action: string;
  timestamp: string;
  user_id: number | null;
  related_entity_type: string | null;
  related_entity_id: number | null;
}

interface UserWithRole extends User {
  user_roles: { role: string }[];
}

function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user data found");

      const user = JSON.parse(userData);

      // Set session variables
      if (user.organization_id) {
        await supabase.rpc('set_session_variables', {
          _user_id: user.id,
          _organization_id: user.organization_id,
          _department_id: user.department_id || null,
          _role: user.role || 'member'
        });
      }

      const [tasksRes, usersRes, activitiesRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('*, user_roles!inner(role)')
          .eq('organization_id', user.organization_id)
          .is('deleted_at', null),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('timestamp', { ascending: false })
          .limit(4)
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (usersRes.error) throw usersRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      setTasks(tasksRes.data || []);
      setUsers(usersRes.data || []);
      setActivities(activitiesRes.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeTasks = tasks.filter(t => t.state === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.state === 'completed').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('completed')) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (action.includes('scheduled') || action.includes('meeting')) return <CalendarDays className="w-4 h-4 text-blue-500" />;
    if (action.includes('joined')) return <UserCircle className="w-4 h-4 text-purple-500" />;
    return <Zap className="w-4 h-4 text-orange-500" />;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your team today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                  <p className="text-3xl font-bold mt-2">{users.length}</p>
                  <div className="flex items-center mt-2 text-xs text-green-600">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +12%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Tasks</p>
                  <p className="text-3xl font-bold mt-2">{activeTasks}</p>
                  <div className="flex items-center mt-2 text-xs text-green-600">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +8%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Meetings Today</p>
                  <p className="text-3xl font-bold mt-2">3</p>
                  <div className="flex items-center mt-2 text-xs text-green-600">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +2
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                  <p className="text-3xl font-bold mt-2">{completionRate}%</p>
                  <div className="flex items-center mt-2 text-xs text-green-600">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +5%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Team Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Team Members</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Your team collaborators</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/team-members">
                      <Users className="w-4 h-4 mr-2" />
                      Manage Team
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : users.length === 0 ? (
                  <p className="text-muted-foreground">No team members yet</p>
                ) : (
                  <div className="space-y-3">
                    {users.slice(0, 3).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name || user.email}</p>
                            <Badge variant="secondary" className="mt-1">
                              {user.user_roles[0]?.role || 'member'}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
                <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-auto flex flex-col items-center gap-3 py-6" asChild>
                    <Link to="/meetings">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CalendarPlus className="w-6 h-6 text-blue-500" />
                      </div>
                      <span>Schedule Meeting</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto flex flex-col items-center gap-3 py-6" asChild>
                    <Link to="/tasks">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <PlusCircle className="w-6 h-6 text-green-500" />
                      </div>
                      <span>Create Task</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto flex flex-col items-center gap-3 py-6" asChild>
                    <Link to="/team-members">
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <UserPlus className="w-6 h-6 text-purple-500" />
                      </div>
                      <span>Invite Member</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto flex flex-col items-center gap-3 py-6" asChild>
                    <Link to="/settings">
                      <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-gray-500" />
                      </div>
                      <span>Team Settings</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Recent Activity</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">What's happening in your team</p>
                  </div>
                  <Button variant="link" size="sm" asChild>
                    <Link to="/activity">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Loading...</p>
                ) : activities.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No recent activity</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="mt-1">
                          {getActivityIcon(activity.action)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{activity.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatActivityTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Weekly Progress</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Task completion this week</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="text-2xl font-bold">{completionRate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary rounded-full h-2 transition-all" 
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Completed</p>
                      <p className="text-lg font-semibold">{completedTasks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                      <p className="text-lg font-semibold">{activeTasks}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
