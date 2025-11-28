import { useState, useEffect } from "react";
import { isValidHHMM, toLocalYMD, combineLocalToUTCISO, toLocal12, convert12To24 } from "@/lib/datetime";
import { persistTaskInsert, persistTaskLinks, persistTaskUpdate } from "@/lib/tasks/persistence";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { setSessionVariables } from "@/hooks/useSessionSetup";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

interface User {
  id: number;
  name: string;
  email: string;
}

interface TaskLink {
  id?: number;
  url: string;
  description?: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any;
  onSuccess: () => void;
}

export function TaskDialog({ open, onOpenChange, task, onSuccess }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [state, setState] = useState(task?.state || "unassigned");
  const [deadlineAt, setDeadlineAt] = useState(task?.deadline_at ? toLocalYMD(task.deadline_at) : "");
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee_id?.toString() || "unassigned");
  const [reviewComment, setReviewComment] = useState(task?.review_comment || "");
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkDescription, setNewLinkDescription] = useState("");
  const [hour12, setHour12] = useState<number>(() => {
    if (task?.deadline_at) return toLocal12(task.deadline_at).hour;
    const h = new Date().getHours();
    return h % 12 === 0 ? 12 : (h % 12);
  });
  const [minute12, setMinute12] = useState<string>(() => {
    if (task?.deadline_at) return toLocal12(task.deadline_at).minute;
    return String(new Date().getMinutes()).padStart(2, '0');
  });
  const [meridiem, setMeridiem] = useState<'AM'|'PM'>(() => {
    if (task?.deadline_at) return toLocal12(task.deadline_at).meridiem;
    return new Date().getHours() >= 12 ? 'PM' : 'AM';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [reassignHistory, setReassignHistory] = useState<{ id: number; action: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (task?.id) {
        fetchTaskLinks();
        fetchReassignHistory();
      }
    }
  }, [open, task?.id]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    setState(task.state || "unassigned");
    setAssigneeId(task.assignee_id?.toString() || "unassigned");
    setReviewComment(task.review_comment || "");
    setDeadlineAt(task.deadline_at ? toLocalYMD(task.deadline_at) : "");
    const now = new Date();
    const h = now.getHours();
    setHour12(h % 12 === 0 ? 12 : (h % 12));
    setMinute12(String(now.getMinutes()).padStart(2,'0'));
    setMeridiem(h >= 12 ? 'PM' : 'AM');
  }, [task?.id]);

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
    } catch {}
  };

  const fetchTaskLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("task_links")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTaskLinks(data || []);
    } catch (error: any) {
      console.error("Error fetching task links:", error);
    }
  };

  const fetchReassignHistory = async () => {
    try {
      if (!task?.id) return;
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, created_at")
        .eq("related_entity_type", "task")
        .eq("related_entity_id", task.id)
        .like("action", "Task returned to assigned%")
        .order("created_at", { ascending: false });
      setReassignHistory((data || []).map(l => ({ id: l.id as number, action: l.action as string, created_at: l.created_at as string })));
    } catch {}
  };

  const addTaskLink = () => {
    if (!newLinkUrl.trim()) {
      toast({ variant: "destructive", title: "Error", description: "URL is required" });
      return;
    }
    try {
      const u = new URL(newLinkUrl);
      if (!(u.protocol === "http:" || u.protocol === "https:")) throw new Error("Invalid protocol");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Enter a valid http(s) URL" });
      return;
    }
    setTaskLinks([...taskLinks, { url: newLinkUrl, description: newLinkDescription }]);
    setNewLinkUrl("");
    setNewLinkDescription("");
  };

  const removeTaskLink = (index: number) => {
    setTaskLinks(taskLinks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user?.id) throw new Error("No user data found");
      await setSessionVariables();

      let deadlineValue: string | null = null;
      if (deadlineAt) {
        const t = convert12To24(hour12, minute12, meridiem);
        if (!isValidHHMM(t)) {
          throw new Error("Invalid time format (HH:MM)");
        }
        const combined = new Date(`${deadlineAt}T${t}:00`);
        if (combined.getTime() <= Date.now()) {
          throw new Error("Deadline must be in the future");
        }
        deadlineValue = `${deadlineAt}T${t}:00`;
      }

      if (task) {
        const { data: current, error: verifyErr } = await supabase
          .from("tasks")
          .select("id, assignee_id, manager_id, deleted_at, users!tasks_assignee_id_fkey(department_id)")
          .eq("id", task.id)
          .limit(1)
          .maybeSingle();
        if (verifyErr) throw verifyErr;
        if (!current) {
          toast({ variant: "destructive", title: "Unable to edit: The selected task no longer exists in the system" });
          return;
        }
        if (current.deleted_at) {
          toast({ variant: "destructive", title: "This task has been deleted and cannot be modified" });
          return;
        }
        const isPrivileged = user?.role === "admin" || user?.role === "owner";
        const isAssignee = current.assignee_id === user?.id;
        const isManager = user?.role === "manager";
        const managerDeptId = user?.department_id ?? null;
        const currentAssigneeDeptId = (current as any)?.users?.department_id ?? null;
        const desiredAssignee = assigneeId && assigneeId !== "unassigned" ? parseInt(assigneeId) : null;
        const managerCanEditCurrent = Boolean(isManager && managerDeptId && (current.assignee_id === null || currentAssigneeDeptId === managerDeptId));
        if (!isPrivileged && !isAssignee && !managerCanEditCurrent) {
          toast({ variant: "destructive", title: "You cannot edit this task because you are not the assignee or its department manager" });
          return;
        }
        if (!isPrivileged && desiredAssignee !== null) {
          if (isManager && managerDeptId) {
            const { data: desiredUser, error: duErr } = await supabase
              .from("users")
              .select("department_id")
              .eq("id", desiredAssignee)
              .limit(1)
              .maybeSingle();
            if (duErr) throw duErr;
            if (!desiredUser || desiredUser.department_id !== managerDeptId) {
              toast({ variant: "destructive", title: "Managers can only assign within their department" });
              return;
            }
          } else if (desiredAssignee !== user?.id) {
            toast({ variant: "destructive", title: "Only admins can change the assignee" });
            return;
          }
        }
        if (!isPrivileged && desiredAssignee === null) {
          if (isManager) {
          } else if (isAssignee) {
            toast({ variant: "destructive", title: "Only admins can unassign tasks" });
            return;
          }
        }
        await persistTaskUpdate(supabase, task.id, {
          title,
          description: description || null,
          state,
          deadline_at: deadlineValue ?? null,
          assignee_id: assigneeId && assigneeId !== "unassigned" ? parseInt(assigneeId) : null,
          review_comment: reviewComment || null,
        });

        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('organization_id', user.organization_id)
          .limit(1)
          .maybeSingle();
        if (team?.id) {
          await supabase
            .from('activity_logs')
            .insert({
              team_id: team.id,
              user_id: user.id,
              organization_id: user.organization_id,
              action: 'Task updated',
              related_entity_type: 'task',
              related_entity_id: task.id,
            });
        }

        await persistTaskLinks(supabase, task.id, taskLinks, user.id);

        toast({
          title: "Task updated",
          description: "Your task has been updated successfully.",
        });
      } else {
        await setSessionVariables();
        const newTask = await persistTaskInsert(supabase, {
          title,
          description: description || null,
          state,
          deadline_at: deadlineValue ?? null,
          assignee_id: assigneeId && assigneeId !== "unassigned" ? parseInt(assigneeId) : null,
          manager_id: user.id,
          review_comment: reviewComment || null,
        });

        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('organization_id', user.organization_id)
          .limit(1)
          .maybeSingle();
        if (team?.id && newTask?.id) {
          await supabase
            .from('activity_logs')
            .insert({
              team_id: team.id,
              user_id: user.id,
              organization_id: user.organization_id,
              action: 'Task created',
              related_entity_type: 'task',
              related_entity_id: newTask.id,
            });
        }

        if (newTask && taskLinks.length > 0) {
          await persistTaskLinks(supabase, newTask.id, taskLinks, user.id);
        }

        toast({
          title: "Task created",
          description: "Your task has been created successfully.",
        });
      }

      onSuccess();
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setState("unassigned");
      setDeadlineAt("");
      const now = new Date();
      const h = now.getHours();
      setHour12(h % 12 === 0 ? 12 : (h % 12));
      setMinute12(String(now.getMinutes()).padStart(2,'0'));
      setMeridiem(h >= 12 ? 'PM' : 'AM');
      setAssigneeId("unassigned");
      setReviewComment("");
      setTaskLinks([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save task",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskLinksUpdate = async (_taskId: number) => {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[900px] md:max-w-[1000px] lg:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? "Edit Task" : "Create Task"}</DialogTitle>
            <DialogDescription>
              {task ? "Update the task details below." : "Add a new task to track."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee">Assign To</Label>
              <Select value={assigneeId || "unassigned"} onValueChange={setAssigneeId}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No Assignee</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          <div className="grid gap-2">
            <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Select value={String(hour12)} onValueChange={(v) => setHour12(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={minute12} onValueChange={(v) => setMinute12(v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2,'0')).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={meridiem} onValueChange={(v) => setMeridiem(v as 'AM'|'PM')}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
          {reassignHistory.length > 0 && (
            <div className="grid gap-2">
              <Label>Reassignment History</Label>
              <div className="text-xs text-muted-foreground space-y-1">
                {reassignHistory.slice(0,5).map(h => (
                  <div key={h.id}>{new Date(h.created_at).toLocaleString()} — {h.action}</div>
                ))}
              </div>
            </div>
          )}
          {(state === "rejected") && (
            <div className="grid gap-2">
                <Label htmlFor="reviewComment">Review Comment</Label>
                <Textarea
                  id="reviewComment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Explain why this task was rejected and what needs to be fixed..."
                  rows={4}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Task Links</Label>
              <div className="space-y-2">
                {taskLinks.map((link, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 border rounded-md">
                    <div className="flex-1 min-w-0">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
                        {link.url}
                      </a>
                      {link.description && (
                        <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      aria-label="Remove link"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTaskLink(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                  <Input
                    aria-label="Task link URL"
                    placeholder="https://example.com"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={newLinkDescription}
                    onChange={(e) => setNewLinkDescription(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTaskLink}
                    className="w-full"
                  >
                    Add Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t mt-4 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : task ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
