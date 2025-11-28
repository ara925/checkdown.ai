import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, Clock, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MeetingDetailDialog } from "@/components/MeetingDetailDialog";
import { NewMeetingDialog } from "@/components/NewMeetingDialog";
import { useSessionSetup, setSessionVariables } from "@/hooks/useSessionSetup";

interface Meeting {
  id: number;
  platform: string | null;
  start_at: string | null;
  end_at: string | null;
  participants_json: string | null;
  external_id: string | null;
  organization_id: number | null;
  created_at: string;
}

function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [newMeetingDialogOpen, setNewMeetingDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const isSessionReady = useSessionSetup();

  useEffect(() => {
    if (isSessionReady) {
      fetchMeetings();
    }
  }, [isSessionReady]);

  const fetchMeetings = async () => {
    try {
      // Set session variables immediately before query
      await setSessionVariables();
      
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch meetings",
      });
    } finally {
      setLoading(false);
    }
  };

  const getParticipantCount = (participantsJson: string | null) => {
    if (!participantsJson) return 0;
    try {
      const participants = JSON.parse(participantsJson);
      return Array.isArray(participants) ? participants.length : 0;
    } catch {
      return 0;
    }
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "Unknown";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDetailDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Meetings</h2>
          <Button onClick={() => setNewMeetingDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Meeting
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading meetings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No meetings yet</p>
              <p className="text-sm text-muted-foreground">
                Meetings will appear here once they're created
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <Card 
                key={meeting.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleMeetingClick(meeting)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {meeting.platform || "Meeting"}
                    </CardTitle>
                    {meeting.platform && (
                      <Badge variant="secondary">{meeting.platform}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {meeting.start_at && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-2" />
                      {new Date(meeting.start_at).toLocaleString()}
                    </div>
                  )}
                  {meeting.start_at && meeting.end_at && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-2" />
                      Duration: {formatDuration(meeting.start_at, meeting.end_at)}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    {getParticipantCount(meeting.participants_json)} participants
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <MeetingDetailDialog
        meeting={selectedMeeting}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <NewMeetingDialog
        open={newMeetingDialogOpen}
        onOpenChange={setNewMeetingDialogOpen}
        onMeetingCreated={fetchMeetings}
      />
    </DashboardLayout>
  );
}

export default function Meetings() {
  return (
    <ProtectedRoute>
      <MeetingsPage />
    </ProtectedRoute>
  );
}
