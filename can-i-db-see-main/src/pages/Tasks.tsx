import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { formatDueLocal12 } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Plus, Search, Pencil, Trash2, ChevronRight, LoaderCircle } from "lucide-react";
import { TaskDialog } from "@/components/TaskDialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSessionSetup, setSessionVariables } from "@/hooks/useSessionSetup";
import { useAuth } from "@/lib/auth/useAuth";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Task {
  id: number;
  title: string;
  state: string;
  assignee_id: number | null;
  manager_id?: number | null;
  deadline_at: string | null;
  description: string | null;
  created_at: string;
  deleted_at?: string | null;
  users?: {
    name: string;
    email: string;
  };
}

function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskView, setTaskView] = useState<'all' | 'my' | 'dept'>('all');
  const [deptOnly, setDeptOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string | null; email: string }[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [teamId, setTeamId] = useState<number | null>(null);
  const { toast } = useToast();
  const isSessionReady = useSessionSetup();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignComment, setReassignComment] = useState("");
  const [reassignTaskId, setReassignTaskId] = useState<number | null>(null);
  const [returnedTaskIds, setReturnedTaskIds] = useState<number[]>([]);
  const [historyByTask, setHistoryByTask] = useState<Record<number, { id: number; action: string; created_at: string }[]>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const refetchTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const fetchSeqRef = useRef(0);

  const scheduleRefetch = (immediate = false) => {
    if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    setSyncing(true);
    const delay = immediate ? 0 : 500;
    refetchTimerRef.current = window.setTimeout(async () => {
      await fetchTasks();
      await fetchStats();
      setSyncing(false);
    }, delay);
  };

  const scheduleRefetchRef = useRef(scheduleRefetch);
  useEffect(() => {
    scheduleRefetchRef.current = scheduleRefetch;
  }, [scheduleRefetch]);

  useEffect(() => {
    if (isSessionReady) {
      fetchUsers();
      scheduleRefetchRef.current(true);
      fetchStats();
      fetchTeam();
    }
  }, [isSessionReady]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (isSessionReady) fetchTasks();
  }, [searchDebounced, page, pageSize, sortBy, sortAsc, stateFilter, assigneeFilter, showDeleted, showCompleted]);

  useEffect(() => {
    setAssigneeFilter(taskView === 'my' ? 'me' : 'all');
    setDeptOnly(taskView === 'dept');
    setPage(1);
  }, [taskView]);

  useEffect(() => {
    if (!isSessionReady) return;
    const channel = supabase.channel('tasks-realtime');
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload: RealtimePostgresChangesPayload<{ id: number; state: string }>) => {
        // Safely access payload properties with proper type guards
        const oldRecord = payload.old && typeof payload.old === 'object' && 'state' in payload.old ? payload.old : null;
        const newRecord = payload.new && typeof payload.new === 'object' && 'state' in payload.new ? payload.new : null;
        const oldState = oldRecord?.state;
        const newState = newRecord?.state;
        const id = (newRecord && 'id' in newRecord ? newRecord.id : null) ?? (oldRecord && 'id' in oldRecord ? oldRecord.id : null);
        if (oldState === 'pending_review' && newState === 'assigned' && typeof id === 'number') {
          setReturnedTaskIds(prev => [...new Set([...prev, id])]);
        }
        scheduleRefetchRef.current();
      }
    );
    channel.subscribe((status: string) => {
      const ok = status === 'SUBSCRIBED';
      setRealtimeConnected(ok);
      if (!ok) {
        if (!pollTimerRef.current) {
          pollTimerRef.current = window.setInterval(() => scheduleRefetchRef.current(true), 15000);
        }
      } else {
        if (pollTimerRef.current) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      }
    });
    return () => {
      supabase.removeChannel(channel);
      if (pollTimerRef.current) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      if (refetchTimerRef.current) { window.clearTimeout(refetchTimerRef.current); refetchTimerRef.current = null; }
    };
  }, [isSessionReady]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setNowTick(Date.now());
  }, [tasks]);

  const fetchUsers = async () => {
    try {
      if (!user?.organization_id) return;
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("organization_id", user.organization_id)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async () => {
    const requestId = ++fetchSeqRef.current;
    
    try {
      // Ensure session is set up before fetching
      const sessionReady = await setSessionVariables();
      if (!sessionReady) {
        console.warn('[Tasks] Session not ready, skipping fetch');
        return;
      }
      
      // Build query with all filters
      let query = supabase
        .from("tasks")
        .select(
          `*, users!tasks_assignee_id_fkey ( name, email, department_id )`,
          { count: "exact" }
        );
        
      if (showDeleted) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }
      if (showCompleted) {
        query = query.eq("state", "approved");
      }
      if (searchDebounced) {
        const term = `%${searchDebounced}%`;
        query = query.or(`title.ilike.${term},description.ilike.${term}`);
      }
      if (stateFilter !== "all") {
        query = query.eq("state", stateFilter);
      }
      if (assigneeFilter === "me" && user?.id) {
        query = query.eq("assignee_id", user.id);
      } else if (assigneeFilter === "unassigned") {
        query = query.is("assignee_id", null);
      } else if (assigneeFilter !== "all") {
        const idNum = Number(assigneeFilter);
        if (!Number.isNaN(idNum)) query = query.eq("assignee_id", idNum);
      }
      if (deptOnly && user?.department_id) {
        query = query.eq("users.department_id", user.department_id);
      }
      
      query = query.order(sortBy, { ascending: sortAsc });
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query.range(from, to);
      
      // Check for stale request
      if (requestId !== fetchSeqRef.current) {
        console.log('[Tasks] Stale request ignored:', requestId);
        return;
      }
      
      if (error) {
        console.error('[Tasks] Fetch error:', error);
        throw error;
      }
      
      // Validate data integrity
      const validTasks = (data || []).filter(task => {
        if (!task.id || !task.title) {
          console.warn('[Tasks] Invalid task data detected:', task);
          return false;
        }
        return true;
      });
      
      setTasks(validTasks);
      setTotalCount(count || 0);
      
      // Fetch activity logs for returned tasks
      if (validTasks.length > 0) {
        const ids = validTasks.map(t => t.id);
        try {
          const { data: logs } = await supabase
            .from("activity_logs")
            .select("id, action, created_at, related_entity_id")
            .in("related_entity_id", ids)
            .eq("related_entity_type", "task")
            .like("action", "Task returned to assigned%")
            .order("created_at", { ascending: false });
          
          if (requestId !== fetchSeqRef.current) return;
          
          const map: Record<number, { id: number; action: string; created_at: string }[]> = {};
          (logs || []).forEach(l => {
            const tid = l.related_entity_id as number;
            if (!map[tid]) map[tid] = [];
            map[tid].push({ id: l.id, action: l.action as string, created_at: l.created_at as string });
          });
          setHistoryByTask(map);
        } catch (logErr) {
          // Don't fail task loading if activity logs fail
          console.warn('[Tasks] Failed to fetch activity logs:', logErr);
          setHistoryByTask({});
        }
      } else {
        if (requestId !== fetchSeqRef.current) return;
        setHistoryByTask({});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tasks";
      console.error('[Tasks] fetchTasks error:', err);
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const states = ["unassigned", "assigned", "pending_review", "approved", "rejected"];
      const results = await Promise.all(
        states.map(s => supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("state", s)
        )
      );
      const next: Record<string, number> = {};
      states.forEach((s, i) => {
        next[s] = (results[i].count as number) || 0;
      });
      setStats(next);
    } catch (e) {
      console.error(e);
    }
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const task = tasks.find(t => t.id === pendingDeleteId);
      const isPrivileged = user?.role === "admin" || user?.role === "owner";
      const isCreator = !!task && task.manager_id === user?.id;
      if (!isPrivileged && !isCreator) {
        toast({ title: "You cannot delete this task because you are not the creator", variant: "destructive" });
        await logActivity("Task delete denied - not creator", pendingDeleteId);
        setConfirmOpen(false);
        setPendingDeleteId(null);
        return;
      }
      await setSessionVariables();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", pendingDeleteId);
      if (error) throw error;
      await logActivity("Task deleted", pendingDeleteId);
      toast({ title: "Task deleted", description: "The task has been deleted successfully." });
      setConfirmOpen(false);
      setPendingDeleteId(null);
      scheduleRefetch(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete task";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const performRestore = async (id: number) => {
    try {
      const task = tasks.find(t => t.id === id);
      const isPrivileged = user?.role === "admin" || user?.role === "owner";
      const isCreator = !!task && task.manager_id === user?.id;
      if (!isPrivileged && !isCreator) {
        toast({ title: "You cannot restore this task because you are not the creator", variant: "destructive" });
        await logActivity("Task restore denied - not creator", id);
        return;
      }
      setLoading(true);
      await setSessionVariables();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
      if (showDeleted) {
        setTasks(prev => prev.filter(t => t.id !== id));
      }
      const { count: deletedCount, error: dErr } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .eq("id", id);
      if (dErr) throw dErr;
      const { data: activeData, count: activeCount, error: aErr } = await supabase
        .from("tasks")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .eq("id", id)
        .limit(1);
      if (aErr) throw aErr;
      if ((deletedCount || 0) !== 0) {
        toast({ variant: "destructive", title: "Restore verification failed", description: "Task still appears in Deleted" });
      } else if ((activeCount || 0) !== 1 || !activeData || activeData.length !== 1) {
        toast({ variant: "destructive", title: "Restore verification failed", description: "Task did not appear in Active" });
      } else {
        toast({ title: "Task restored", description: "The task has been moved to Active" });
      }
      await logActivity("Task restored", id);
      await fetchTasks();
      await fetchStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore task";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleEdit = async (task: Task) => {
    const isDeleted = !!task.deleted_at;
    if (isDeleted || showDeleted) {
      toast({ variant: "destructive", title: "This task has been deleted and cannot be modified" });
      return;
    }
    try {
      await setSessionVariables();
      const { data, error } = await supabase
        .from("tasks")
        .select("id, deleted_at")
        .eq("id", task.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ variant: "destructive", title: "Unable to edit: The selected task no longer exists in the system" });
        return;
      }
      if (data.deleted_at) {
        toast({ variant: "destructive", title: "This task has been deleted and cannot be modified" });
        return;
      }
      setSelectedTask(task);
      setDialogOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to verify task";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const handleCreate = () => {
    setSelectedTask(undefined);
    setDialogOpen(true);
  };

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const isPrivileged = user?.role === "admin" || user?.role === "owner";
      const allowedIds = selectedIds.filter(id => {
        const task = tasks.find(t => t.id === id);
        return isPrivileged || (!!task && task.manager_id === user?.id);
      });
      const deniedIds = selectedIds.filter(id => !allowedIds.includes(id));
      for (const id of deniedIds) {
        await logActivity("Task delete denied (bulk) - not creator", id);
      }
      if (deniedIds.length > 0) {
        toast({ title: "Some tasks were not deleted", description: "You are not the creator of certain selected tasks", variant: "destructive" });
      }
      if (allowedIds.length === 0) return;
      await setSessionVariables();
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", allowedIds);
      if (error) throw error;
      for (const id of allowedIds) await logActivity("Task deleted (bulk)", id);
      toast({ title: "Deleted", description: "Allowed tasks moved to trash." });
      setSelectedIds([]);
      scheduleRefetch(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk delete failed";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const bulkChangeState = async (nextState: string) => {
    if (selectedIds.length === 0) return;
    try {
      const isPrivileged = user?.role === "admin" || user?.role === "owner";
      const allowedIds = selectedIds.filter(id => {
        const task = tasks.find(t => t.id === id);
        return isPrivileged || (!!task && task.assignee_id === user?.id);
      });
      const deniedIds = selectedIds.filter(id => !allowedIds.includes(id));
      for (const id of deniedIds) {
        await logActivity("Task state change denied (bulk) - not assignee", id);
      }
      if (deniedIds.length > 0) {
        toast({ title: "Some states were not changed", description: "You are not the assignee of certain selected tasks", variant: "destructive" });
      }
      if (allowedIds.length === 0) return;
      await setSessionVariables();
      const { error } = await supabase
        .from("tasks")
        .update({ state: nextState })
        .in("id", allowedIds);
      if (error) throw error;
      for (const id of allowedIds) await logActivity(`Task state updated to ${nextState}`, id);
      toast({ title: "Updated", description: "State updated for allowed tasks." });
      setSelectedIds([]);
      scheduleRefetch(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk update failed";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const inlineUpdateState = async (id: number, nextState: string) => {
    try {
      const task = tasks.find(t => t.id === id);
      if (task?.deleted_at) {
        toast({ title: "This task has been deleted and cannot be modified", variant: "destructive" });
        await logActivity("Task state change denied - deleted", id);
        return;
      }
      const isPrivileged = user?.role === "admin" || user?.role === "owner";
      const isAssignee = task?.assignee_id === user?.id;
      if (!isPrivileged && !isAssignee) {
        toast({ title: "You cannot change state because you are not the assignee", variant: "destructive" });
        await logActivity("Task state change denied - not assignee", id);
        return;
      }
      if (task?.state === "pending_review" && nextState === "assigned" && isPrivileged) {
        setReassignTaskId(id);
        setReassignOpen(true);
        return;
      }
      await setSessionVariables();
      const { data: row } = await supabase
        .from("tasks")
        .select("id, deleted_at")
        .eq("id", id)
        .limit(1)
        .maybeSingle();
      if (!row) {
        toast({ variant: "destructive", title: "Unable to edit: The selected task no longer exists in the system" });
        return;
      }
      if (row.deleted_at) {
        toast({ variant: "destructive", title: "This task has been deleted and cannot be modified" });
        await logActivity("Task state change denied - deleted (server)", id);
        return;
      }
      const { error } = await supabase
        .from("tasks")
        .update({ state: nextState })
        .eq("id", id);
      if (error) throw error;
      await logActivity(`Task state updated to ${nextState}`, id);
      scheduleRefetch(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update state";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const confirmReassign = async () => {
    try {
      if (!reassignTaskId) return;
      if (!reassignComment.trim()) {
        toast({ variant: "destructive", title: "Comment required", description: "Please add a reason for reassignment" });
        return;
      }
      await setSessionVariables();
      const { error } = await supabase
        .from("tasks")
        .update({ state: "assigned", review_comment: reassignComment })
        .eq("id", reassignTaskId);
      if (error) throw error;
      await logActivity(`Task returned to assigned: ${reassignComment}`, reassignTaskId);
      const t = tasks.find(x => x.id === reassignTaskId);
      if (t?.assignee_id) {
        try {
          const { data: settings } = await supabase
            .from("notification_settings")
            .select("email_enabled")
            .eq("user_id", t.assignee_id)
            .maybeSingle();
          await supabase.functions.invoke('notify-chat', {
            body: {
              targetUserId: t.assignee_id,
              title: 'Task returned for rework',
              body: reassignComment,
              url: '/tasks'
            }
          });
        } catch { void 0; }
      }
      setReturnedTaskIds(prev => [...new Set([...prev, reassignTaskId])]);
      setReassignOpen(false);
      setReassignComment("");
      setReassignTaskId(null);
      scheduleRefetch(true);
      toast({ title: "Task reassigned", description: "The task was returned to Assigned with a reason" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reassign task";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const inlineUpdateAssignee = async (id: number, nextAssignee: string) => {
    try {
      const task = tasks.find(t => t.id === id);
      if (task?.deleted_at) {
        toast({ title: "This task has been deleted and cannot be modified", variant: "destructive" });
        await logActivity("Assignee update denied - deleted", id);
        return;
      }
      const isPrivileged = user?.role === "admin" || user?.role === "owner" || user?.role === "manager";
      if (!isPrivileged) {
        toast({ title: "You do not have permission to assign tasks", variant: "destructive" });
        await logActivity("Assignee update denied - insufficient privileges", id);
        return;
      }
      const value = nextAssignee === "unassigned" ? null : parseInt(nextAssignee);
      if (nextAssignee !== "unassigned" && Number.isNaN(value)) {
        toast({ title: "Selection error", description: "Invalid assignee selected", variant: "destructive" });
        return;
      }
      await setSessionVariables();
      const { data: row } = await supabase
        .from("tasks")
        .select("id, deleted_at")
        .eq("id", id)
        .limit(1)
        .maybeSingle();
      if (!row) {
        toast({ variant: "destructive", title: "Unable to edit: The selected task no longer exists in the system" });
        return;
      }
      if (row.deleted_at) {
        toast({ variant: "destructive", title: "This task has been deleted and cannot be modified" });
        await logActivity("Assignee update denied - deleted (server)", id);
        return;
      }
      const selectedUser = users.find(u => u.id === value);
      const shouldAssign = value !== null && task?.state === "unassigned";
      const shouldUnassign = value === null && (task?.state === "assigned" || task?.state === "pending_review");
      const payload: TablesUpdate<'tasks'> = { assignee_id: value, updated_at: new Date().toISOString() };
      if (shouldAssign) payload.state = "assigned";
      if (shouldUnassign) payload.state = "unassigned";
      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      await logActivity(shouldAssign ? `Task assigned to ${selectedUser?.name || selectedUser?.email || value}` : (shouldUnassign ? "Task unassigned" : "Task assignee updated"), id);
      scheduleRefetch(true);
      toast({ title: shouldAssign ? "Assigned" : (shouldUnassign ? "Unassigned" : "Updated"), description: shouldAssign ? `Task assigned to ${selectedUser?.name || selectedUser?.email || value}` : (shouldUnassign ? "Task set to unassigned" : "Assignee updated") });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update assignee";
      toast({ variant: "destructive", title: "Error", description: message });
    }
  };

  const getStateBadgeVariant = (state: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      unassigned: "secondary",
      assigned: "default",
      pending_review: "outline",
      approved: "default",
      rejected: "destructive",
    };
    return variants[state] || "default";
  };

  const fetchTeam = async () => {
    try {
      if (!user?.organization_id) return;
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", user.organization_id)
        .limit(1)
        .maybeSingle();
      if (data?.id) setTeamId(data.id);
    } catch { void 0; }
  };

  const logActivity = async (action: string, relatedId?: number) => {
    try {
      if (!user?.id || !user.organization_id) return;
      const tid = teamId;
      if (!tid) return;
      await supabase
        .from("activity_logs")
        .insert({
          team_id: tid,
          user_id: user.id,
          organization_id: user.organization_id,
          action,
          related_entity_type: "task",
          related_entity_id: relatedId ?? null,
        });
    } catch { void 0; }
  };

  const remainingMs = useCallback((t: Task) => {
    if (!t.deadline_at) return Number.POSITIVE_INFINITY;
    const d = new Date(t.deadline_at).getTime();
    return d - nowTick;
  }, [nowTick]);

  const isUrgent = useCallback((t: Task) => {
    const ms = remainingMs(t);
    return ms > 0 && ms <= 60 * 60 * 1000;
  }, [remainingMs]);

  const displayTasks = useMemo(() => {
    const urgent = tasks.filter(isUrgent).sort((a, b) => remainingMs(a) - remainingMs(b));
    const normal = tasks.filter(t => !isUrgent(t));
    return [...urgent, ...normal];
  }, [tasks, nowTick, isUrgent, remainingMs]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">Tasks</h2>
          {syncing && <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Syncing updates" />}
          {!realtimeConnected && <Badge variant="outline">Reconnecting</Badge>}
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="mb-6">
        <Tabs value={taskView} onValueChange={(v) => setTaskView(v as 'all' | 'my' | 'dept')}>
          <TabsList aria-label="Task view" className="w-full">
            <TabsTrigger value="my" aria-label="My Tasks">My Tasks</TabsTrigger>
            {user?.role === 'manager' && (
              <TabsTrigger value="dept" aria-label="My Department Tasks">My Department Tasks</TabsTrigger>
            )}
            <TabsTrigger value="all" aria-label="All Tasks">All Tasks</TabsTrigger>
          </TabsList>
          <TabsContent value="my" className="mt-4">
            <h3 className="text-xl font-semibold">My Tasks</h3>
          </TabsContent>
          {user?.role === 'manager' && (
            <TabsContent value="dept" className="mt-4">
              <h3 className="text-xl font-semibold">My Department Tasks</h3>
            </TabsContent>
          )}
          <TabsContent value="all" className="mt-4">
            <h3 className="text-xl font-semibold">All Tasks</h3>
          </TabsContent>
        </Tabs>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="me">My Tasks</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created</SelectItem>
                <SelectItem value="deadline_at">Deadline</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortAsc ? "asc" : "desc"} onValueChange={(v) => setSortAsc(v === "asc") }>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Asc</SelectItem>
                <SelectItem value="desc">Desc</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch aria-label="Show deleted" checked={showDeleted} onCheckedChange={(c) => { setShowDeleted(!!c); setPage(1); }} />
              <span className="text-sm">Show Deleted</span>
              <Switch aria-label="Show completed" checked={showCompleted} onCheckedChange={(c) => { setShowCompleted(!!c); setPage(1); }} />
              <span className="text-sm">Show Completed</span>
            </div>
          </div>
        </div>

        
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {search ? "No tasks found" : "No tasks yet"}
            </p>
            {!search && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{taskView === 'my' ? 'My Tasks' : 'All Tasks'}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={bulkDelete} disabled={selectedIds.length === 0}>Delete Selected</Button>
            <Select onValueChange={(v) => bulkChangeState(v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Change state for selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Selected: {selectedIds.length}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayTasks.map((task) => (
            <Card key={task.id} className={`task-card-frame flex flex-col hover:shadow-lg transition-shadow ${returnedTaskIds.includes(task.id) ? 'ring-2 ring-yellow-400' : ''} ${showDeleted ? 'opacity-60' : ''}`} style={isUrgent(task) ? { backgroundColor: '#FFF0F0' } : undefined}>
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg line-clamp-2" style={isUrgent(task) ? { color: '#FF0000' } : undefined}>{task.title || 'Untitled'}</CardTitle>
                  <Badge variant={getStateBadgeVariant(task.state)}>
                    {task.state.replace("_", " ")}
                  </Badge>
                  {showDeleted && (
                    <Badge variant="destructive">Deleted</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="task-card-inner">
                <div className="flex items-start gap-2 mb-2">
                  {showDeleted ? (
                    <Button variant="outline" size="sm" onClick={() => performRestore(task.id)}>Restore</Button>
                  ) : (
                    <div className="flex flex-wrap items-start gap-2">
                      {task.state === 'pending_review' && (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager') && (
                        <div className="flex flex-col gap-2">
                          <Button aria-label="Return to Assigned" variant="outline" size="sm" onClick={() => { setReassignTaskId(task.id); setReassignOpen(true); }}>
                            Return to Assigned
                          </Button>
                          <Button aria-label="Complete Task" variant="default" size="sm" onClick={() => inlineUpdateState(task.id, 'approved')}>
                            Complete Task
                          </Button>
                        </div>
                      )}
                      <Select value={task.assignee_id ? String(task.assignee_id) : "unassigned"} onValueChange={(v) => inlineUpdateAssignee(task.id, v)}>
                        <SelectTrigger aria-label="Task assignee" className="w-full sm:w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">No Assignee</SelectItem>
                          {users.map(u => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="task-card-body">
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mb-2 truncate">
                    Assigned to: {task.users ? (task.users.name || task.users.email) : 'Unassigned'} {returnedTaskIds.includes(task.id) ? <Badge variant="outline" className="ml-2">Returned</Badge> : null}
                  </p>
                  {task.deadline_at && (
                    <p className="text-xs text-muted-foreground mb-3" style={isUrgent(task) ? { color: '#FF0000' } : undefined}>
                      Due: {formatDueLocal12(task.deadline_at)}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(task)} disabled={showDeleted} aria-disabled={showDeleted}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(task.id)} disabled={showDeleted} aria-disabled={showDeleted}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-muted-foreground">Total: {totalCount}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
              <div className="text-sm">Page {page}</div>
              <Button variant="outline" size="sm" disabled={(page * pageSize) >= totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        onSuccess={fetchTasks}
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark the task as deleted. You can confirm or cancel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={reassignOpen} onOpenChange={(o) => { setReassignOpen(o); if (!o) { setReassignComment(''); setReassignTaskId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return task to Assigned</AlertDialogTitle>
            <AlertDialogDescription>
              Add a comment explaining why this task is being returned for additional work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input placeholder="Reason for reassignment" value={reassignComment} onChange={(e) => setReassignComment(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReassign}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

export default function Tasks() {
  return (
    <ProtectedRoute>
      <TasksPage />
    </ProtectedRoute>
  );
}
