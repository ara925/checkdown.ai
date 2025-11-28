import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Clock } from "lucide-react";

interface Task {
  id: number;
  title: string;
  state: string;
  assignee_id: number | null;
  users?: {
    name: string | null;
    email: string;
  };
}

interface Meeting {
  id: number;
  platform: string | null;
  start_at: string | null;
  end_at: string | null;
  external_id: string | null;
  organization_id: number | null;
}

interface MeetingDetailDialogProps {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingDetailDialog({ meeting, open, onOpenChange }: MeetingDetailDialogProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (meeting && open) {
      fetchLinkedTasks();
    }
  }, [meeting, open]);

  const fetchLinkedTasks = async () => {
    if (!meeting) return;
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          users!tasks_assignee_id_fkey (
            name,
            email
          )
        `)
        .eq("meeting_id", meeting.id);

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      case "review":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStateLabel = (state: string) => {
    return state
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meeting Detail</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{meeting.platform || "Meeting"}</h3>
            <p className="text-sm text-muted-foreground">
              {meeting.external_id || `org ${meeting.organization_id}`} · {" "}
              {meeting.start_at
                ? new Date(meeting.start_at).toLocaleString()
                : "No date set"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
              <video controls className="w-full h-full">
                <source src="" type="video/mp4" />
              </video>
              <p className="absolute text-white text-sm">No video asset attached</p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Video URL (optional)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <Button>Attach & Auto-Create Tasks</Button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Linked Tasks</h3>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks linked to this meeting yet</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge 
                              variant="secondary"
                              className={`${getStateColor(task.state)} text-white`}
                            >
                              {getStateLabel(task.state)}
                            </Badge>
                          </div>
                          {task.users && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{task.users.name || task.users.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
