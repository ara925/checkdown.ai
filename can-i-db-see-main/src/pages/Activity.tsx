import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Activity as ActivityIcon, User, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

interface ActivityLog {
  id: number;
  action: string;
  timestamp: string;
  user_id: number | null;
  team_id: number;
  organization_id: number | null;
  ip_address: string | null;
  related_entity_type: string | null;
  related_entity_id: number | null;
  user_name: string | null;
  user_email: string | null;
  task_title: string | null;
  meeting_platform: string | null;
  department_name: string | null;
}

function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [realtime, setRealtime] = useState(false);
  const [channelSubscribed, setChannelSubscribed] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchActivities = async () => {
    try {
      // Fetch activity logs first
      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Get unique user, task, meeting, and department IDs
      const userIds = [...new Set(logs?.map(l => l.user_id).filter(Boolean))] as number[];
      const taskIds = [...new Set(logs?.filter(l => l.related_entity_type === 'task').map(l => l.related_entity_id).filter(Boolean))] as number[];
      const meetingIds = [...new Set(logs?.filter(l => l.related_entity_type === 'meeting').map(l => l.related_entity_id).filter(Boolean))] as number[];
      const departmentIds = [...new Set(logs?.filter(l => l.related_entity_type === 'department').map(l => l.related_entity_id).filter(Boolean))] as number[];

      // Fetch related data
      const [usersData, tasksData, meetingsData, departmentsData] = await Promise.all([
        userIds.length > 0 ? supabase.from("users").select("id, name, email").in("id", userIds) : { data: [] },
        taskIds.length > 0 ? supabase.from("tasks").select("id, title").in("id", taskIds) : { data: [] },
        meetingIds.length > 0 ? supabase.from("meetings").select("id, platform").in("id", meetingIds) : { data: [] },
        departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : { data: [] },
      ]);

      // Create lookup maps
      const usersMap = new Map((usersData.data || []).map(u => [u.id, u] as const));
      const tasksMap = new Map((tasksData.data || []).map(t => [t.id, t] as const));
      const meetingsMap = new Map((meetingsData.data || []).map(m => [m.id, m] as const));
      const departmentsMap = new Map((departmentsData.data || []).map(d => [d.id, d] as const));

      // Format the data
      const formattedData = logs?.map((log: any) => {
        const user = usersMap.get(log.user_id) as any;
        const task = log.related_entity_type === 'task' ? tasksMap.get(log.related_entity_id) as any : null;
        const meeting = log.related_entity_type === 'meeting' ? meetingsMap.get(log.related_entity_id) as any : null;
        const department = log.related_entity_type === 'department' ? departmentsMap.get(log.related_entity_id) as any : null;

        return {
          ...log,
          user_name: user?.name || null,
          user_email: user?.email || null,
          task_title: task?.title || null,
          meeting_platform: meeting?.platform || null,
          department_name: department?.name || null,
        };
      }) || [];
      
      setActivities(formattedData);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch activities",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!realtime || channelSubscribed) return;
    const channel = supabase.channel("activity_logs_listener");
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, async () => {
      try { await fetchActivities(); } catch {}
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setChannelSubscribed(true);
    });
    return () => {
      try { channel.unsubscribe(); } catch {}
      setChannelSubscribed(false);
    };
  }, [realtime, channelSubscribed]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create")) return "default";
    if (action.includes("update")) return "secondary";
    if (action.includes("delete")) return "destructive";
    if (action.includes("sign")) return "outline";
    return "default";
  };

  const formatAction = (activity: ActivityLog) => {
    const user = activity.user_name || "Someone";
    const action = activity.action;
    
    // Parse different action types into conversational English with entity details
    if (action.includes("sign_in") || action.includes("signin")) {
      return `${user} signed in`;
    }
    if (action.includes("sign_up") || action.includes("signup")) {
      return `${user} created an account`;
    }
    if (action.includes("sign_out") || action.includes("signout")) {
      return `${user} signed out`;
    }
    if (action.includes("task.create")) {
      return activity.task_title 
        ? `${user} created task "${activity.task_title}"`
        : `${user} created a new task`;
    }
    if (action.includes("task.update")) {
      return activity.task_title 
        ? `${user} updated task "${activity.task_title}"`
        : `${user} updated a task`;
    }
    if (action.includes("task.delete")) {
      return activity.task_title 
        ? `${user} deleted task "${activity.task_title}"`
        : `${user} deleted a task`;
    }
    if (action.includes("task.complete")) {
      return activity.task_title 
        ? `${user} completed task "${activity.task_title}"`
        : `${user} completed a task`;
    }
    if (action.includes("meeting.create")) {
      return activity.meeting_platform
        ? `${user} scheduled a ${activity.meeting_platform} meeting`
        : `${user} scheduled a meeting`;
    }
    if (action.includes("meeting.update")) {
      return activity.meeting_platform
        ? `${user} updated a ${activity.meeting_platform} meeting`
        : `${user} updated a meeting`;
    }
    if (action.includes("team_member.add")) {
      return `${user} added a team member`;
    }
    if (action.includes("team_member.remove")) {
      return `${user} removed a team member`;
    }
    if (action.includes("department.create")) {
      return activity.department_name 
        ? `${user} created department "${activity.department_name}"`
        : `${user} created a department`;
    }
    if (action.includes("department.delete")) {
      return activity.department_name 
        ? `${user} deleted department "${activity.department_name}"`
        : `${user} deleted a department`;
    }
    
    // Default fallback - make it conversational
    return `${user} ${action.replace(/[._]/g, " ").toLowerCase()}`;
  };

  const filtered = useMemo(() => {
    const a = activities.filter((x) => {
      const matchesType = typeFilter === 'all' ? true : (x.related_entity_type || '').toLowerCase() === typeFilter.toLowerCase();
      if (!matchesType) return false;
      if (!debouncedSearch) return true;
      const s = debouncedSearch;
      const hay = `${x.user_name || ''} ${x.user_email || ''} ${x.action} ${x.task_title || ''} ${x.meeting_platform || ''} ${x.department_name || ''}`.toLowerCase();
      return hay.includes(s);
    });
    return a;
  }, [activities, typeFilter, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Activity Log</h2>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative w-72">
            <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="department">Departments</SelectItem>
            </SelectContent>
          </Select>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={realtime} onChange={(e) => setRealtime(e.target.checked)} />
            Live updates
          </label>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ActivityIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No activities yet</p>
              <p className="text-sm text-muted-foreground">
                Activity logs will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {currentPageItems.map((activity) => (
              <Card key={activity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2">
                        <p className="text-sm font-medium">
                          {formatAction(activity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                        {activity.user_email && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {activity.user_email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Pagination className="mt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 py-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function Activity() {
  return (
    <ProtectedRoute>
      <ActivityPage />
    </ProtectedRoute>
  );
}
