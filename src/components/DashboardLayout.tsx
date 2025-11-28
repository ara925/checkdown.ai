import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setSessionVariables } from "@/hooks/useSessionSetup";
import { 
  Calendar, 
  CheckSquare, 
  MessageCircle, 
  LayoutGrid, 
  Users, 
  Building2, 
  Activity, 
  Bell, 
  Shield, 
  Settings, 
  Mail, 
  Calendar as CalendarIcon,
  Lock,
  Search,
  BellRing,
  User,
  LogOut,
  Bug
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigationSections = [
  {
    title: "WORKSPACE",
    items: [
      { path: "/meetings", label: "Meetings", icon: Calendar },
      { path: "/tasks", label: "Tasks", icon: CheckSquare },
      { path: "/chat", label: "Chat", icon: MessageCircle },
    ]
  },
  {
    title: "ORGANIZATION",
    items: [
      { path: "/dashboard", label: "Overview", icon: LayoutGrid },
      { path: "/organization", label: "Organization", icon: Building2 },
      { path: "/team-members", label: "Team Members", icon: Users },
      { path: "/departments", label: "Departments", icon: Building2 },
    ]
  },
  {
    title: "ADMIN",
    items: [
      { path: "/activity", label: "Activity", icon: Activity },
      { path: "/notifications", label: "Notifications", icon: Bell },
      { path: "/security", label: "Security", icon: Shield },
      { path: "/settings", label: "Settings", icon: Settings },
      { path: "/devtools", label: "DevTools", icon: Bug },
    ]
  },
  {
    title: "INTEGRATIONS",
    items: [
      { path: "/integrations/email", label: "Email", icon: Mail },
      { path: "/integrations/harvest", label: "Harvest", icon: CalendarIcon },
      { path: "/integrations/vault", label: "Vault", icon: Lock },
    ]
  }
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [chatUnreadTotal, setChatUnreadTotal] = useState<number>(0);
  const [chatRealtimeChannel, setChatRealtimeChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  const getInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    const setup = async () => {
      try {
        if (!user?.id) return;
        await setSessionVariables();

        const { data: threadsRes } = await supabase
          .from("threads")
          .select("id, matrix_room_id")
          .like("matrix_room_id", "dm:%");

        const meId = user.id;
        const myThreadIds: number[] = [];
        for (const t of threadsRes || []) {
          const parts = (t.matrix_room_id || "").replace("dm:", "").split("-");
          const [a, b] = parts.map(Number);
          if (a === meId || b === meId) myThreadIds.push(t.id);
        }

        if (myThreadIds.length === 0) {
          setChatUnreadTotal(0);
        } else {
          const { data: msgs } = await supabase
            .from("thread_messages")
            .select("id, user_id, thread_id")
            .in("thread_id", myThreadIds)
            .neq("user_id", meId);
          const messageIds = (msgs || []).map((m: any) => m.id);
          if (messageIds.length === 0) {
            setChatUnreadTotal(0);
          } else {
            const { data: receipts } = await supabase
              .from("thread_message_receipts")
              .select("message_id")
              .eq("user_id", meId)
              .in("message_id", messageIds);
            const read = new Set((receipts || []).map((r: any) => r.message_id));
            const total = messageIds.filter((id) => !read.has(id)).length;
            setChatUnreadTotal(total);
          }
        }

        if (chatRealtimeChannel) {
          try { chatRealtimeChannel.unsubscribe(); } catch {}
        }
        const channel = supabase.channel("global_chat_unread");
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thread_messages' }, async (payload) => {
          try {
            if (!user?.id) return;
            const row = payload.new as any;
            const { data: thread } = await supabase
              .from("threads")
              .select("matrix_room_id, id")
              .eq("id", row.thread_id)
              .single();
            if (!thread) return;
            const parts = (thread.matrix_room_id || "").replace("dm:", "").split("-");
            const [a, b] = parts.map(Number);
            if (a !== user.id && b !== user.id) return;
            if (row.user_id === user.id) return;
            setChatUnreadTotal(prev => prev + 1);
          } catch {}
        });
        const readCh = supabase.channel('chat_read_events', { config: { broadcast: { self: true } } });
        readCh.on('broadcast', { event: 'read' }, (payload: any) => {
          const c = (payload?.payload?.count) || 0;
          if (c > 0) setChatUnreadTotal(prev => Math.max(0, prev - c));
        });
        readCh.on('broadcast', { event: 'mark_unread' }, (payload: any) => {
          const c = (payload?.payload?.count) || 0;
          if (c > 0) setChatUnreadTotal(prev => prev + c);
        });
        channel.subscribe();
        readCh.subscribe();
        setChatRealtimeChannel(channel);
      } catch (e) {
        /* ignore */
      }
    };

    setup();

    return () => {
      try { chatRealtimeChannel?.unsubscribe(); } catch {}
    };
  }, [user?.id]);

  useEffect(() => {
    if (location.pathname === '/chat') {
      (async () => {
        try {
          if (!user?.id) return;
          await setSessionVariables();
          const { data: threadsRes } = await supabase
            .from("threads")
            .select("id, matrix_room_id")
            .like("matrix_room_id", "dm:%");
          const meId = user.id;
          const myThreadIds: number[] = [];
          for (const t of threadsRes || []) {
            const parts = (t.matrix_room_id || "").replace("dm:", "").split("-");
            const [a, b] = parts.map(Number);
            if (a === meId || b === meId) myThreadIds.push(t.id);
          }
          if (myThreadIds.length === 0) {
            setChatUnreadTotal(0);
          } else {
            const { data: msgs } = await supabase
              .from("thread_messages")
              .select("id, user_id, thread_id")
              .in("thread_id", myThreadIds)
              .neq("user_id", meId);
            const messageIds = (msgs || []).map((m: any) => m.id);
            if (messageIds.length === 0) {
              setChatUnreadTotal(0);
            } else {
              const { data: receipts } = await supabase
                .from("thread_message_receipts")
                .select("message_id")
                .eq("user_id", meId)
                .in("message_id", messageIds);
              const read = new Set((receipts || []).map((r: any) => r.message_id));
              const total = messageIds.filter((id) => !read.has(id)).length;
              setChatUnreadTotal(total);
            }
          }
        } catch {}
      })();
    }
  }, [location.pathname, user?.id]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex-shrink-0 text-sidebar-foreground">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-primary">TrackSpot</h1>
        </div>

        <nav className="px-3 space-y-6">
          {navigationSections.map((section) => (
            <div key={section.title}>
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground ring-1 ring-sidebar-ring font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex items-center gap-2">
                        {item.label}
                        {item.path === '/chat' && chatUnreadTotal > 0 && (
                          <span className="h-5 min-w-[20px] px-1.5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">
                            {chatUnreadTotal}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b flex items-center px-6 gap-4 text-primary-foreground" style={{ backgroundImage: "var(--gradient-primary)" }}>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks, meetings, people..."
                className="pl-9 bg-background"
              />
            </div>
          </div>
          <button className="relative">
            <BellRing className="h-5 w-5 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
