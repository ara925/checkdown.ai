import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Plus, Send, Phone, Paperclip, Smile, Loader2, Pencil, Trash2, ChevronDown, Image, Reply } from "lucide-react";
import EmojiPicker from "@/components/media/EmojiPicker";
import GifPicker from "@/components/media/GifPicker";
import { useShortcuts } from "@/lib/shortcuts/ShortcutProvider";
import { useLayoutSettings } from "@/lib/layout/LayoutSettings";
import { useCall } from "@/contexts/CallContext";
import LayoutTuner from "@/components/LayoutTuner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { canEditMessage, decrementUnread, formatEditCountdown } from "@/lib/chat";
import { useToast } from "@/hooks/use-toast";
import { useSessionSetup, setSessionVariables } from "@/hooks/useSessionSetup";

type ConversationType = { 
  threadId: number; 
  participantId: number; 
  participantName: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

function ChatPage() {
  const navigate = useNavigate();
  const { startCall: startContextCall } = useCall();
  const [selectedConversation, setSelectedConversation] = useState<ConversationType | null>(null);
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [members, setMembers] = useState<{ id: number; name: string | null; email: string; department_id: number | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<{ id: number; user_id: number | null; text: string; created_at: string; updated_at: string }[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const [globalMessagesChannel, setGlobalMessagesChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [typingChannel, setTypingChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimeoutRef = useRef<any>(null);
  const [reactions, setReactions] = useState<Record<number, { emoji: string; count: number; reactedByMe: boolean }[]>>({});
  const [reactionChannel, setReactionChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [reactionPendingMap, setReactionPendingMap] = useState<Record<number, Record<string, boolean>>>({});
  const [receiptsChannel, setReceiptsChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [readEventsChannel, setReadEventsChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [seenByOther, setSeenByOther] = useState<Set<number>>(new Set());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const selectedConversationRef = useRef<ConversationType | null>(null);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const { toast } = useToast();
  const isSessionReady = useSessionSetup();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const shortcuts = useShortcuts();
  const { settings } = useLayoutSettings();
  const [tunerOpen, setTunerOpen] = useState(false);
  const editWindowSeconds = 120;
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const visibleObserverRef = useRef<IntersectionObserver | null>(null);
  const pendingReceiptsRef = useRef<Set<number>>(new Set());
  const sentReceiptsRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<any>(null);
  const [editHistoryOpenId, setEditHistoryOpenId] = useState<number | null>(null);
  const [editHistory, setEditHistory] = useState<{ id: number; edited_at: string; editor_id: number; old_text: string; new_text: string }[]>([]);

  const escapeHtml = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatMessage = (text: string) => {
    let t = escapeHtml(text);
    t = t.replace(/```([\s\S]*?)```/g, (_m, p1) => `<pre class="whitespace-pre-wrap"><code>${p1}</code></pre>`);
    t = t.replace(/`([^`]+)`/g, (_m, p1) => `<code>${p1}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);
    t = t.replace(/\*([^*]+)\*/g, (_m, p1) => `<em>${p1}</em>`);
    t = t.replace(/@([\w.-]+@[\w.-]+)/g, (_m, p1) => `<span class="bg-yellow-100 text-yellow-900 px-1 rounded">@${p1}</span>`);
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, p1, p2) => `<a href="${p2}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${p1}</a>`);
    t = t.replace(/(https?:\/\/[^\s]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${m}</a>`);
    t = t.replace(/\n/g, "<br/>");
    return t;
  };

  const renderFormatted = (text: string) => {
    return <div dangerouslySetInnerHTML={{ __html: formatMessage(text) }} />;
  };

  useEffect(() => {
    if (!isSessionReady) return;
    fetchMembers();
    loadExistingConversations();
    setupGlobalMessageListener();
    (async () => {
      try {
        await setSessionVariables();
        const userData = localStorage.getItem("user");
        if (!userData) return;
        const me = JSON.parse(userData);
        const { data } = await supabase
          .from('user_roles')
          .select('role, organization_id')
          .eq('user_id', me.id)
          .limit(1)
          .maybeSingle();
        setIsAdmin(!!data && (data.role === 'admin' || data.role === 'owner'));
      } catch {}
    })();
  }, [isSessionReady]);

  useEffect(() => {
    return () => {
      try { globalMessagesChannel?.unsubscribe(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) return;
    if (conversations.length === 0) return;
    const withUnread = conversations.filter(c => c.unreadCount > 0);
    const target = withUnread.length > 0 ? withUnread[0] : conversations[0];
    setSelectedConversation(target);
  }, [conversations]);

  useEffect(() => {
    if (!selectedConversation) return;
    fetchMessagesForDM(selectedConversation.participantId);
    markMessagesAsRead(selectedConversation.threadId);
    setTimeout(() => {
      const el = messagesScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      setIsNearBottom(true);
    }, 0);
  }, [selectedConversation]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation || null;
  }, [selectedConversation]);

  const groupedMembers = useMemo(() => {
    const filtered = members.filter(m => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (m.name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
    const unassigned = filtered.filter(m => m.department_id === null);
    const byDept: Record<number, { id: number; name: string; members: typeof members }> = {} as any;
    departments.forEach(d => { byDept[d.id] = { id: d.id, name: d.name, members: [] as any } });
    filtered.forEach(m => {
      if (m.department_id === null) return;
      if (!byDept[m.department_id]) return;
      byDept[m.department_id].members.push(m);
    });
    return { unassigned, byDept: Object.values(byDept).filter(d => d.members.length > 0) };
  }, [members, departments, search]);

  const fetchTeam = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      if (!me.organization_id) return;
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", me.organization_id)
        .limit(1)
        .maybeSingle();
      if (data?.id) setTeamId(data.id);
    } catch { void 0; }
  };

  useEffect(() => { fetchTeam(); }, []);

  const logActivity = async (action: string, relatedId?: number, relatedType: string = "thread_message") => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData || !teamId) return;
      const me = JSON.parse(userData);
      await supabase.from("activity_logs").insert({
        team_id: teamId,
        user_id: me.id,
        organization_id: me.organization_id,
        action,
        related_entity_type: relatedType,
        related_entity_id: relatedId ?? null,
      });
    } catch { void 0; }
  };

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user session");
      const user = JSON.parse(userData);
      const [usersRes, deptRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, email, department_id")
          .eq("organization_id", user.organization_id)
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("departments")
          .select("id, name")
          .eq("organization_id", user.organization_id)
          .order("name")
      ]);
      if (usersRes.error) throw usersRes.error;
      if (deptRes.error) throw deptRes.error;
      setMembers(usersRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load members", variant: "destructive" });
    } finally {
      setLoadingMembers(false);
    }
  };

  const ensureThreadForDM = async (otherUserId: number) => {
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user session");
    const me = JSON.parse(userData);
    const a = Math.min(me.id, otherUserId);
    const b = Math.max(me.id, otherUserId);
    const roomKey = `dm:${a}-${b}`;
    const existing = await supabase
      .from("threads")
      .select("id")
      .eq("matrix_room_id", roomKey)
      .order("id", { ascending: true })
      .limit(1);
    if (existing.error) throw existing.error;
    if ((existing.data || []).length > 0) return existing.data![0].id as number;
    const created = await supabase
      .from("threads")
      .insert({ matrix_room_id: roomKey, task_id: null })
      .select("id")
      .single();
    if (created.error) throw created.error;
    return created.data.id as number;
  };

  const loadExistingConversations = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);

      // Get all DM threads for current user with aggregated data
      const { data: threads } = await supabase
        .from("threads")
        .select(`
          id, 
          matrix_room_id,
          thread_messages (
            id,
            user_id,
            created_at
          )
        `)
        .like("matrix_room_id", "dm:%");

      if (!threads) return;

      // Filter threads where user is a participant and aggregate
      const byParticipant: Record<number, ConversationType> = {};

      for (const thread of threads) {
        const roomKey = thread.matrix_room_id;
        const parts = roomKey.replace("dm:", "").split("-");
        const [a, b] = parts.map(Number);
        if (a !== me.id && b !== me.id) continue;
        const otherUserId = a === me.id ? b : a;

        const messages = (thread.thread_messages || []) as any[];
        const lastMsg = messages.length > 0 ? messages.reduce((latest, msg) => 
          new Date(msg.created_at) > new Date(latest.created_at) ? msg : latest
        ) : null;

        // Count unread: messages from other user without receipts
        let unreadCount = 0;
        const otherUserMessages = messages.filter(m => m.user_id !== me.id);
        if (otherUserMessages.length > 0) {
          const messageIds = otherUserMessages.map(m => m.id);
          const { data: receipts } = await supabase
            .from("thread_message_receipts")
            .select("message_id")
            .eq("user_id", me.id)
            .in("message_id", messageIds);
          
          const readIds = new Set((receipts || []).map(r => r.message_id));
          unreadCount = otherUserMessages.filter(m => !readIds.has(m.id)).length;
        }

        const candidate: ConversationType = {
          threadId: thread.id,
          participantId: otherUserId,
          participantName: null, // Will be fetched in batch below
          lastMessageAt: lastMsg?.created_at || null,
          unreadCount
        };

        const existing = byParticipant[otherUserId];
        if (!existing) {
          byParticipant[otherUserId] = candidate;
        } else {
          const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
          const candidateTime = candidate.lastMessageAt ? new Date(candidate.lastMessageAt).getTime() : 0;
          if (candidateTime > existingTime) {
            byParticipant[otherUserId] = candidate;
          }
        }
      }

      // Batch fetch all participant names
      const participantIds = Object.keys(byParticipant).map(Number);
      if (participantIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", participantIds);
        
        const userMap = new Map((users || []).map(u => [u.id, u.name]));
        Object.keys(byParticipant).forEach(id => {
          byParticipant[Number(id)].participantName = userMap.get(Number(id)) || null;
        });
      }

      const userConversations = Object.values(byParticipant).sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      setConversations(userConversations);
    } catch (e: any) {
      console.error("Failed to load conversations:", e);
    }
  };

  const setupGlobalMessageListener = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      
      // Cleanup previous channel
      if (globalMessagesChannel) {
        try { 
          await globalMessagesChannel.unsubscribe(); 
        } catch (e) {
          console.log("Error unsubscribing from global messages:", e);
        }
      }
      
      // Listen to all new messages in any thread
      const channel = supabase.channel("global_messages_listener");
      
      channel.on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'thread_messages' 
      }, async (payload) => {
        const row = payload.new as any;
        console.log("📩 New message received:", row);
        
        // Skip if this is our own message (already added optimistically)
        if (row.user_id === me.id) {
          console.log("Skipping own message");
          return;
        }
        
        // Get thread info to determine conversation
        const { data: thread } = await supabase
          .from("threads")
          .select("matrix_room_id")
          .eq("id", row.thread_id)
          .single();
        
        if (!thread) {
          console.log("Thread not found");
          return;
        }
        
        const roomKey = thread.matrix_room_id;
        if (!roomKey.startsWith("dm:")) {
          console.log("Not a DM thread");
          return;
        }
        
        const parts = roomKey.replace("dm:", "").split("-");
        const [a, b] = parts.map(Number);
        
        if (a !== me.id && b !== me.id) {
          console.log("Not my conversation");
          return;
        }
        
        const otherUserId = a === me.id ? b : a;
        console.log("Message from user:", otherUserId);
        
        // Update conversations list
        setConversations(prev => {
          const existing = prev.find(c => c.participantId === otherUserId);
          
          if (existing) {
            // Update existing conversation
            const updated = prev.map(c => {
              if (c.participantId === otherUserId) {
                const isCurrentlyViewing = selectedConversation?.participantId === otherUserId;
                return {
                  ...c,
                  lastMessageAt: row.created_at,
                  // Only increment unread if not currently viewing this chat
                  unreadCount: isCurrentlyViewing ? 0 : c.unreadCount + 1
                };
              }
              return c;
            });
            
            // Sort by most recent
            return updated.sort((x, y) => {
              if (!x.lastMessageAt) return 1;
              if (!y.lastMessageAt) return -1;
              return new Date(y.lastMessageAt).getTime() - new Date(x.lastMessageAt).getTime();
            });
          }
          
          // New conversation - fetch participant name
          (async () => {
            const { data: user } = await supabase
              .from("users")
              .select("name")
              .eq("id", otherUserId)
              .maybeSingle();
            
            setConversations(p => {
              const existingConv = p.find(c => c.participantId === otherUserId);
              if (!existingConv) {
                return [
                  {
                    threadId: row.thread_id,
                    participantId: otherUserId,
                    participantName: user?.name || null,
                    lastMessageAt: row.created_at,
                    unreadCount: 1
                  },
                  ...p
                ];
              }
              return p.map(c => c.participantId === otherUserId ? { ...c, participantName: user?.name || null } : c);
            });
          })();
          
          return prev;
        });
        
        // If viewing this conversation, add message to view and mark as read
        if (selectedConversationRef.current && selectedConversationRef.current.participantId === otherUserId) {
          console.log("Adding message to current view");
          setMessages(prev => {
            if (prev.find(m => m.id === row.id)) return prev;
            const next = [...prev, { id: row.id, user_id: row.user_id, text: row.text, created_at: row.created_at, updated_at: row.updated_at || row.created_at }];
            next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return next;
          });
          if (!isNearBottom) setShowJumpToLatest(true);
          
          // Auto-mark as read since we're viewing
          setTimeout(() => {
            if (selectedConversationRef.current) {
              markMessagesAsRead(selectedConversationRef.current.threadId);
            }
          }, 500);
        }
      });
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'thread_message_receipts'
      }, async (payload) => {
        const row = payload.new as any;
        const userData = localStorage.getItem("user");
        if (!userData) return;
        const me = JSON.parse(userData);
        if (row.user_id !== me.id) return;
        const { data: msg } = await supabase
          .from('thread_messages')
          .select('thread_id')
          .eq('id', row.message_id)
          .maybeSingle();
        if (!msg) return;
        setConversations(prev => prev.map(c => c.threadId === msg.thread_id ? { ...c, unreadCount: decrementUnread(c.unreadCount, 1) } : c));
        if (selectedConversationRef.current && selectedConversationRef.current.threadId === msg.thread_id) {
          setLastViewedAt(new Date().toISOString());
        }
      });
      
      channel.on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'thread_messages' 
      }, async (payload) => {
        const row = payload.new as any;
        // Update message content and updated_at in view if present
        try {
          const { data: thread } = await supabase
            .from("threads")
            .select("matrix_room_id")
            .eq("id", row.thread_id)
            .single();
          if (!thread) return;
          const userData = localStorage.getItem("user");
          if (!userData) return;
          const me = JSON.parse(userData);
          const parts = thread.matrix_room_id.replace("dm:", "").split("-");
          const [a, b] = parts.map(Number);
          if (a !== me.id && b !== me.id) return;
          const otherUserId = a === me.id ? b : a;
          if (selectedConversationRef.current && selectedConversationRef.current.participantId === otherUserId) {
            setMessages(prev => prev.map(m => m.id === row.id ? { ...m, text: row.text, updated_at: row.updated_at || m.updated_at } : m));
          }
        } catch {}
      });

      channel.on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'thread_messages' 
      }, async (payload) => {
        const row = payload.old as any;
        try {
          const { data: thread } = await supabase
            .from("threads")
            .select("matrix_room_id")
            .eq("id", row.thread_id)
            .single();
          if (!thread) return;
          const userData = localStorage.getItem("user");
          if (!userData) return;
          const me = JSON.parse(userData);
          const parts = thread.matrix_room_id.replace("dm:", "").split("-");
          const [a, b] = parts.map(Number);
          if (a !== me.id && b !== me.id) return;
          const otherUserId = a === me.id ? b : a;
          if (selectedConversationRef.current && selectedConversationRef.current.participantId === otherUserId) {
            setMessages(prev => prev.filter(m => m.id !== row.id));
          }
        } catch {}
      });
      
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'thread_messages'
      }, async (payload) => {
        const row = payload.new as any;
        setMessages(prev => prev.map(m => m.id === row.id ? { ...m, text: row.text, updated_at: row.updated_at } : m));
        if (selectedConversationRef.current) {
          setConversations(prev => prev.map(c => c.threadId === row.thread_id ? { ...c, lastMessageAt: row.updated_at } : c));
        }
      });
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          setRealtimeError(null);
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
          setRealtimeError(status);
          const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current || 0));
          reconnectAttemptsRef.current = (reconnectAttemptsRef.current || 0) + 1;
          setTimeout(() => {
            setupGlobalMessageListener();
          }, delay);
        }
      });
      
      setGlobalMessagesChannel(channel);
    } catch (e: any) {
      console.error("Failed to setup message listener:", e);
      setRealtimeConnected(false);
      setRealtimeError(e?.message || "failed");
    }
  };

  const markMessagesAsRead = async (threadId: number) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);

      // Get all unread messages for this thread
      const { data: messages } = await supabase
        .from("thread_messages")
        .select("id, user_id")
        .eq("thread_id", threadId)
        .neq("user_id", me.id);

      if (!messages || messages.length === 0) {
        setConversations(prev => prev.map(c => 
          c.threadId === threadId ? { ...c, unreadCount: 0 } : c
        ));
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Check which messages are already read
      const { data: existingReceipts } = await supabase
        .from("thread_message_receipts")
        .select("message_id")
        .eq("user_id", me.id)
        .in("message_id", messageIds);

      const readIds = new Set((existingReceipts || []).map(r => r.message_id));
      const unreadMessages = messages.filter(m => !readIds.has(m.id));

      // Mark unread messages as read
      if (unreadMessages.length > 0) {
        const receipts = unreadMessages.map(m => ({
          message_id: m.id,
          user_id: me.id,
          read_at: new Date().toISOString()
        }));

        await supabase
          .from("thread_message_receipts")
          .upsert(receipts, { onConflict: "message_id,user_id" });

        try { readEventsChannel?.send({ type: 'broadcast', event: 'read', payload: { count: unreadMessages.length } }); } catch {}
      }

      // Update UI
      setConversations(prev => prev.map(c => 
        c.threadId === threadId ? { ...c, unreadCount: 0 } : c
      ));

      try { localStorage.setItem(`chat_last_viewed_${threadId}`, new Date().toISOString()); } catch {}
    } catch (e: any) {
      console.error("Failed to mark messages as read:", e);
    }
  };

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    if (visibleObserverRef.current) {
      try { visibleObserverRef.current.disconnect(); } catch {}
    }
    const observer = new IntersectionObserver((entries) => {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const idAttr = (entry.target as HTMLElement).getAttribute("data-message-id");
          const authorAttr = (entry.target as HTMLElement).getAttribute("data-author-id");
          if (!idAttr) return;
          const mid = Number(idAttr);
          const authorId = authorAttr ? Number(authorAttr) : null;
          if (authorId === null || authorId === me.id) return;
          if (sentReceiptsRef.current.has(mid)) return;
          pendingReceiptsRef.current.add(mid);
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(async () => {
              try {
                const ids = Array.from(pendingReceiptsRef.current);
                pendingReceiptsRef.current.clear();
                if (ids.length === 0 || !selectedConversation) return;
                const userData2 = localStorage.getItem("user");
                if (!userData2) return;
                const me2 = JSON.parse(userData2);
                const rows = ids.map((x) => ({ message_id: x, user_id: me2.id, read_at: new Date().toISOString() }));
                await supabase.from("thread_message_receipts").upsert(rows, { onConflict: "message_id,user_id" });
                rows.forEach((r) => sentReceiptsRef.current.add(r.message_id));
                setConversations((prev) => prev.map((c) => c.threadId === selectedConversation.threadId ? { ...c, unreadCount: decrementUnread(c.unreadCount, ids.length) } : c));
                setLastViewedAt(new Date().toISOString());
              } catch {}
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }, 250);
          }
        }
      });
    }, { threshold: [0.6] });
    visibleObserverRef.current = observer;
    const nodes = Array.from(el.querySelectorAll('[data-chat-message]'));
    nodes.forEach((n) => observer.observe(n));
    return () => { try { observer.disconnect(); } catch {} };
  }, [messages, selectedConversation]);

  const startConversationWith = async (member: { id: number; name: string | null }) => {
    try {
      await setSessionVariables();
      const threadId = await ensureThreadForDM(member.id);
      const existingByParticipant = conversations.find(c => c.participantId === member.id);
      const newConv: ConversationType = existingByParticipant ? {
        ...existingByParticipant,
        threadId
      } : {
        threadId,
        participantId: member.id,
        participantName: member.name,
        lastMessageAt: null,
        unreadCount: 0
      };

      setSelectedConversation(newConv);
      setConversations(prev => {
        const exists = prev.find(c => c.participantId === member.id);
        if (exists) {
          return prev.map(c => c.participantId === member.id ? { ...newConv } : c);
        }
        return [newConv, ...prev];
      });
      setNewConvOpen(false);
      setSearch("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to start conversation", variant: "destructive" });
    }
  };

  const fetchMessagesForDM = async (participantId: number) => {
    try {
      setLoadingMessages(true);
      await setSessionVariables();
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user session");
      const me = JSON.parse(userData);
      const a = Math.min(me.id, participantId);
      const b = Math.max(me.id, participantId);
      const roomKey = `dm:${a}-${b}`;
      const threadsRes = await supabase
        .from("threads")
        .select("id")
        .eq("matrix_room_id", roomKey)
        .order("id", { ascending: true });
      if (threadsRes.error) throw threadsRes.error;
      const ids = (threadsRes.data || []).map(t => t.id);
      if (ids.length === 0) { setMessages([]); return; }
      const msgsRes = await supabase
        .from("thread_messages")
        .select("id, user_id, text, created_at, thread_id")
        .in("thread_id", ids)
        .order("created_at", { ascending: true });
      if (msgsRes.error) throw msgsRes.error;
      const list = (msgsRes.data || []).map(m => ({ id: m.id, user_id: m.user_id, text: m.text, created_at: m.created_at, updated_at: m.created_at }));
      setMessages(list);
      const messageIds = list.map(m => m.id);
      await loadReactionsForMessages(messageIds);
      await handleReceiptsAfterView(list);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load messages", variant: "destructive" });
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadReactionsForMessages = async (ids: number[]) => {
    try {
      if (ids.length === 0) { setReactions({}); return; }
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      const { data, error } = await ((supabase as any)
        .from('thread_message_reactions'))
        .select('message_id, emoji, user_id')
        .in('message_id', ids);
      if (error) throw error;
      const grouped: Record<number, Record<string, { count: number; reactedByMe: boolean }>> = {};
      (data || []).forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = {};
        if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = { count: 0, reactedByMe: false };
        grouped[r.message_id][r.emoji].count += 1;
        if (r.user_id === me.id) grouped[r.message_id][r.emoji].reactedByMe = true;
      });
      const mapped: Record<number, { emoji: string; count: number; reactedByMe: boolean }[]> = {};
      Object.entries(grouped).forEach(([mid, em]) => {
        mapped[Number(mid)] = Object.entries(em).map(([emoji, meta]) => ({ emoji, count: meta.count, reactedByMe: meta.reactedByMe }));
      });
      setReactions(mapped);
      setupReactionRealtime(ids);
    } catch {}
  };

  const setupReactionRealtime = (ids: number[]) => {
    try {
      if (reactionChannel) { 
        try { 
          reactionChannel.unsubscribe(); 
        } catch (e) {
          console.log("Error unsubscribing from reactions:", e);
        }
      }
      const ch = supabase.channel(`thread_message_reactions_${Date.now()}`);
      
      ch.on('postgres_changes' as any, { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'thread_message_reactions' 
      } as any, (payload: any) => {
        const row = payload.new;
        console.log("👍 Reaction added:", row);
        if (!ids.includes(row.message_id)) return;
        
        setReactions(prev => {
          const list = prev[row.message_id] || [];
          const found = list.find(x => x.emoji === row.emoji);
          const userData = localStorage.getItem('user');
          const me = userData ? JSON.parse(userData) : null;
          
          if (found) {
            return { 
              ...prev, 
              [row.message_id]: list.map(x => 
                x.emoji === row.emoji 
                  ? { emoji: x.emoji, count: x.count + 1, reactedByMe: x.reactedByMe || (!!me && row.user_id === me.id) } 
                  : x
              ) 
            };
          } else {
            return { 
              ...prev, 
              [row.message_id]: [...list, { emoji: row.emoji, count: 1, reactedByMe: !!me && row.user_id === me.id }] 
            };
          }
        });
      });
      
      ch.on('postgres_changes' as any, { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'thread_message_reactions' 
      } as any, (payload: any) => {
        const row = payload.old;
        console.log("👎 Reaction removed:", row);
        if (!ids.includes(row.message_id)) return;
        
        setReactions(prev => {
          const list = prev[row.message_id] || [];
          const userData = localStorage.getItem('user');
          const me = userData ? JSON.parse(userData) : null;
          const updated = list.map(x => 
            x.emoji === row.emoji 
              ? { emoji: x.emoji, count: Math.max(0, x.count - 1), reactedByMe: (!!me && row.user_id === me.id) ? false : x.reactedByMe } 
              : x
          ).filter(x => x.count > 0);
          return { ...prev, [row.message_id]: updated };
        });
      });
      
      ch.subscribe((status) => {
        console.log("Reaction channel status:", status);
      });
      setReactionChannel(ch);
    } catch (e) {
      console.error("Error setting up reaction realtime:", e);
    }
  };

  const handleReceiptsAfterView = async (list: { id: number; user_id: number | null; text: string; created_at: string }[]) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData || !selectedConversation) return;
      const me = JSON.parse(userData);
      const viewedIds = list.filter(m => m.user_id !== me.id).map(m => m.id);
      if (viewedIds.length > 0) {
        const payload = viewedIds.map(id => ({ message_id: id, user_id: me.id, read_at: new Date().toISOString() }));
        await ((supabase as any)
          .from('thread_message_receipts'))
          .upsert(payload, { onConflict: 'message_id,user_id' });
      }
      const myIds = list.filter(m => m.user_id === me.id).map(m => m.id);
      if (myIds.length > 0) {
        const { data } = await ((supabase as any)
          .from('thread_message_receipts'))
          .select('message_id, user_id')
          .eq('user_id', selectedConversation.participantId)
          .in('message_id', myIds);
        const s = new Set<number>();
        (data || []).forEach((r: any) => s.add(r.message_id));
        setSeenByOther(s);
        setupReceiptsRealtime(myIds);
      } else {
        setSeenByOther(new Set());
      }
    } catch {}
  };

  const setupReceiptsRealtime = (ids: number[]) => {
    try {
      if (receiptsChannel) { 
        try { 
          receiptsChannel.unsubscribe(); 
        } catch (e) {
          console.log("Error unsubscribing from receipts:", e);
        }
      }
      const ch = supabase.channel(`thread_message_receipts_${Date.now()}`);
      
      ch.on('postgres_changes' as any, { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'thread_message_receipts' 
      } as any, (payload: any) => {
        const row = payload.new;
        console.log("✓ Message read receipt:", row);
        if (!selectedConversation) return;
        if (row.user_id !== selectedConversation.participantId) return;
        if (!ids.includes(row.message_id)) return;
        setSeenByOther(prev => new Set([...prev, row.message_id]));
      });
      
      ch.subscribe((status) => {
        console.log("Receipts channel status:", status);
      });
      setReceiptsChannel(ch);
    } catch (e) {
      console.error("Error setting up receipts realtime:", e);
    }
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    try {
      await setSessionVariables();
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      const pending = reactionPendingMap[messageId]?.[emoji];
      if (pending) return;
      setReactionPendingMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId] || {}), [emoji]: true } }));
      const list = reactions[messageId] || [];
      const found = list.find(x => x.emoji === emoji);
      const meReacted = !!found && found.reactedByMe;
      setReactions(prev => {
        const cur = prev[messageId] || [];
        if (meReacted) {
          const updated = cur.map(x => x.emoji === emoji ? { emoji: x.emoji, count: Math.max(0, x.count - 1), reactedByMe: false } : x).filter(x => x.count > 0);
          return { ...prev, [messageId]: updated };
        } else {
          const updated = found ? cur.map(x => x.emoji === emoji ? { emoji: x.emoji, count: x.count + 1, reactedByMe: true } : x) : [...cur, { emoji, count: 1, reactedByMe: true }];
          return { ...prev, [messageId]: updated };
        }
      });
      const { data: existing } = await (supabase as any)
        .from('thread_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', me.id)
        .eq('emoji', emoji)
        .maybeSingle();
      if (existing) {
        const { error: deleteError } = await (supabase as any)
          .from('thread_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', me.id)
          .eq('emoji', emoji);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await (supabase as any)
          .from('thread_message_reactions')
          .insert({ message_id: messageId, user_id: me.id, emoji });
        if (insertError) throw insertError;
      }
      setReactionPendingMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId] || {}), [emoji]: false } }));
    } catch (e: any) {
      setReactionPendingMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId] || {}), [emoji]: false } }));
      setReactions(prev => {
        const cur = prev[messageId] || [];
        const found = cur.find(x => x.emoji === emoji);
        if (!found) return prev;
        const reverted = found.reactedByMe
          ? cur.map(x => x.emoji === emoji ? { emoji: x.emoji, count: Math.max(0, x.count - 1), reactedByMe: false } : x).filter(x => x.count > 0)
          : cur.map(x => x.emoji === emoji ? { emoji: x.emoji, count: x.count + 1, reactedByMe: true } : x);
        return { ...prev, [messageId]: reverted };
      });
      const queue = JSON.parse(localStorage.getItem('reaction_offline_queue') || '[]');
      const list = Array.isArray(queue) ? queue : [];
      const list2 = [...list, { messageId, emoji, ts: Date.now() }];
      localStorage.setItem('reaction_offline_queue', JSON.stringify(list2));
      toast({ title: 'Reaction error', description: e.message || 'Failed to toggle reaction; will retry', variant: 'destructive' });
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !messageText.trim()) return;
    const tempId = -Date.now(); // Use negative number for temp IDs
    const tempMessage = {
      id: tempId,
      user_id: null,
      text: messageText.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    try {
      setSending(true);
      await setSessionVariables();
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user session");
      const me = JSON.parse(userData);
      
      // Optimistically add message to UI
      setMessages(prev => [...prev, { ...tempMessage, user_id: me.id }]);
      const textToSend = messageText.trim();
      setMessageText("");
      
      let insertRes = await supabase
        .from("thread_messages")
        .insert({ thread_id: selectedConversation.threadId, user_id: me.id, text: textToSend })
        .select("id, user_id, text, created_at, updated_at")
        .single();
      if (insertRes.error) {
        insertRes = await supabase
          .from("thread_messages")
          .insert({ thread_id: selectedConversation.threadId, user_id: me.id, text: textToSend })
          .select("id, user_id, text, created_at")
          .single();
        if (insertRes.error) throw insertRes.error;
      }
      const data = insertRes.data as any;
      
      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, id: data.id, user_id: data.user_id, text: data.text, created_at: data.created_at, updated_at: (data as any).updated_at || data.created_at } : m));
      
      // Update conversation with latest message
      setConversations(prev => prev.map(c => 
        c.threadId === selectedConversation.threadId 
          ? { ...c, lastMessageAt: data.created_at } 
          : c
      ).sort((x, y) => {
        if (!x.lastMessageAt) return 1;
        if (!y.lastMessageAt) return -1;
        return new Date(y.lastMessageAt).getTime() - new Date(x.lastMessageAt).getTime();
      }));
      
      // Send notifications
      const text = data?.text || "";
      const parts = text.match(/@([\w.-]+@[\w.-]+)/g) || [];
      const emails = parts.map(p => p.replace('@', ''));
      if (emails.length > 0) {
        const { data: users } = await supabase.from('users').select('id, email').in('email', emails);
        for (const u of users || []) {
          await supabase.functions.invoke('notify-chat', { body: { targetUserId: u.id, title: 'Mention', body: text, url: `/chat` } });
        }
      }
      await supabase.functions.invoke('notify-chat', { body: { targetUserId: selectedConversation.participantId, title: selectedConversation.participantName || 'Chat', body: text, url: `/chat` } });
    } catch (e: any) {
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessageText(tempMessage.text); // Restore message text
      
      const offline = JSON.parse(localStorage.getItem('chat_offline_queue') || '[]');
      offline.push({ threadId: selectedConversation.threadId, text: tempMessage.text, ts: Date.now() });
      localStorage.setItem('chat_offline_queue', JSON.stringify(offline));
      toast({ title: "Error", description: e.message || "Failed to send, queued offline", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const replyTo = (m: { text: string }) => {
    const plain = m.text.replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, "$1");
    const quoted = `> ${plain}\n`;
    setMessageText(prev => prev ? `${prev}\n${quoted}` : quoted);
  };

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;
    try {
      setSending(true);
      await setSessionVariables();
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user session");
      const me = JSON.parse(userData);
      const bucket = supabase.storage.from('chat');
      const name = `${selectedConversation.threadId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const upload = await bucket.upload(name, file);
      if (upload.error) throw upload.error;
      const pub = bucket.getPublicUrl(name);
      const url: string = (pub?.data?.publicUrl) || '';
      const linkText = `[${file.name}](${url})`;
      const { data, error } = await supabase
        .from('thread_messages')
        .insert({ thread_id: selectedConversation.threadId, user_id: me.id, text: linkText })
        .select('id, user_id, text, created_at')
        .single();
      if (error) throw error;
      e.target.value = '';
      await fetchMessagesForDM(selectedConversation.participantId);
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  

  useEffect(() => {
    const flush = async () => {
      try {
        await setSessionVariables();
        const userData = localStorage.getItem('user');
        if (!userData) return;
        const me = JSON.parse(userData);
        const arr = JSON.parse(localStorage.getItem('chat_offline_queue') || '[]');
        if (!Array.isArray(arr) || arr.length === 0) return;
        for (const item of arr) {
          await supabase.from('thread_messages').insert({ thread_id: item.threadId, user_id: me.id, text: item.text });
        }
        localStorage.removeItem('chat_offline_queue');
      } catch {}
    };
    flush();
  }, []);

  useEffect(() => {
    const flushReactions = async () => {
      try {
        await setSessionVariables();
        const userData = localStorage.getItem('user');
        if (!userData) return;
        const me = JSON.parse(userData);
        const arr = JSON.parse(localStorage.getItem('reaction_offline_queue') || '[]');
        if (!Array.isArray(arr) || arr.length === 0) return;
        const rest: any[] = [];
        for (const item of arr) {
          try {
            const { data: existing } = await (supabase as any)
              .from('thread_message_reactions')
              .select('id')
              .eq('message_id', item.messageId)
              .eq('user_id', me.id)
              .eq('emoji', item.emoji)
              .maybeSingle();
            if (existing) {
              await (supabase as any)
                .from('thread_message_reactions')
                .delete()
                .eq('message_id', item.messageId)
                .eq('user_id', me.id)
                .eq('emoji', item.emoji);
            } else {
              await (supabase as any)
                .from('thread_message_reactions')
                .insert({ message_id: item.messageId, user_id: me.id, emoji: item.emoji });
            }
          } catch {
            rest.push(item);
          }
        }
        if (rest.length > 0) {
          localStorage.setItem('reaction_offline_queue', JSON.stringify(rest));
        } else {
          localStorage.removeItem('reaction_offline_queue');
        }
      } catch {}
    };
    flushReactions();
    const online = () => flushReactions();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setupGlobalMessageListener();
    };
    const onOffline = () => {
      setRealtimeConnected(false);
      setRealtimeError('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    try {
      if (readEventsChannel) { try { readEventsChannel.unsubscribe(); } catch {} }
      const ch = supabase.channel('chat_read_events', { config: { broadcast: { self: true } } });
      ch.subscribe();
      setReadEventsChannel(ch);
      return () => { try { ch.unsubscribe(); } catch {} };
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    const userData = localStorage.getItem("user");
    if (!userData) return;
    const me = JSON.parse(userData);
    const a = Math.min(me.id, selectedConversation.participantId);
    const b = Math.max(me.id, selectedConversation.participantId);
    const roomKey = `typing:dm:${a}-${b}`;
    if (typingChannel) { try { typingChannel.unsubscribe(); } catch {} }
    const ch = supabase.channel(roomKey, { config: { broadcast: { self: true } } });
    ch.on('broadcast', { event: 'typing' }, () => {
      setIsOtherTyping(true);
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); }
      typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
    });
    ch.subscribe();
    setTypingChannel(ch);
  }, [selectedConversation?.participantId]);

  const handleMessageInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setMessageText(e.target.value);
    const now = Date.now();
    if (typingChannel && now - lastTypingSentRef.current > 1000) {
      lastTypingSentRef.current = now;
      typingChannel.send({ type: 'broadcast', event: 'typing', payload: { t: now } });
    }
  };
  const handleMessageTextareaChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    setMessageText(e.target.value);
    const now = Date.now();
    if (typingChannel && now - lastTypingSentRef.current > 1000) {
      lastTypingSentRef.current = now;
      typingChannel.send({ type: 'broadcast', event: 'typing', payload: { t: now } });
    }
  };

  useEffect(() => {
    const send = () => { if (!sending) sendMessage(); };
    const toggleEmoji = () => setEmojiOpen(v => !v);
    const toggleGif = () => setGifOpen(v => !v);
    const jump = () => {
      const el = messagesScrollRef.current; if (!el) return; el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setShowJumpToLatest(false);
    };
    const markU = () => handleMarkUnread();
    const openLayout = () => setTunerOpen(true);
    shortcuts.on("chat.send", send);
    shortcuts.on("chat.toggleEmoji", toggleEmoji);
    shortcuts.on("chat.toggleGif", toggleGif);
    shortcuts.on("chat.jumpLatest", jump);
    shortcuts.on("chat.markUnread", markU);
    shortcuts.on("app.openLayoutTuner", openLayout);
    return () => {
      shortcuts.off("chat.send", send);
      shortcuts.off("chat.toggleEmoji", toggleEmoji);
      shortcuts.off("chat.toggleGif", toggleGif);
      shortcuts.off("chat.jumpLatest", jump);
      shortcuts.off("chat.markUnread", markU);
      shortcuts.off("app.openLayoutTuner", openLayout);
    };
  }, [shortcuts, sending]);

  const userOwnsMessage = (userId: number | null) => {
    const userData = localStorage.getItem('user');
    if (!userData || userId === null) return false;
    const me = JSON.parse(userData);
    return me.id === userId;
  };

  const beginEdit = (m: { id: number; text: string }) => {
    setEditingMessageId(m.id);
    setEditingText(m.text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const saveEdit = async (id: number) => {
    try {
      const msg = messages.find(m => m.id === id) || null;
      const isAuthor = !!msg && userOwnsMessage(msg.user_id);
      if (!isAuthor && !isAdmin) {
        toast({ title: 'You cannot edit this message because you are not the author', variant: 'destructive' });
        await logActivity('Message edit denied - not author', id);
        return;
      }
      if (msg) {
        const createdTs = new Date(msg.created_at).getTime();
        const nowTs = Date.now();
        const allowed = nowTs - createdTs <= editWindowSeconds * 1000;
        if (!allowed) {
          toast({ title: 'Editing window expired', description: 'Messages can be edited within 2 minutes of sending', variant: 'destructive' });
          await logActivity('Message edit denied - window expired', id);
          return;
        }
      }
      await setSessionVariables();
      let updRes = await supabase
        .from('thread_messages')
        .update({ text: editingText })
        .eq('id', id)
        .select('id, user_id, text, created_at, updated_at')
        .single();
      if (updRes.error) {
        updRes = await supabase
          .from('thread_messages')
          .update({ text: editingText })
          .eq('id', id)
          .select('id, user_id, text, created_at')
          .single();
        if (updRes.error) throw updRes.error;
      }
      const data2 = updRes.data as any;
      setMessages(prev => prev.map(m => m.id === id ? { id: data2.id, user_id: data2.user_id, text: data2.text, created_at: data2.created_at, updated_at: (data2 as any).updated_at || data2.created_at } : m));
      await logActivity('Message edited', id);
      cancelEdit();
    } catch (e: any) {
      toast({ title: 'Edit failed', description: e.message || 'Could not edit message', variant: 'destructive' });
      await logActivity('Message edit failed', id);
    }
  };

  const deleteMessage = async (id: number) => {
    try {
      const msg = messages.find(m => m.id === id) || null;
      const isAuthor = !!msg && userOwnsMessage(msg.user_id);
      if (!isAuthor) {
        toast({ title: 'You cannot delete this message because you are not the author', variant: 'destructive' });
        await logActivity('Message delete denied - not author', id);
        return;
      }
      await setSessionVariables();
      const { error } = await supabase
        .from('thread_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== id));
      await logActivity('Message deleted', id);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message || 'Could not delete message', variant: 'destructive' });
      await logActivity('Message delete failed', id);
    }
  };

  const handleMarkUnread = async () => {
    if (!selectedConversation) return;
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      const otherId = selectedConversation.participantId;
      
      // Find the latest message from the other user
      const latest = [...messages]
        .filter(m => m.user_id === otherId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (!latest) return;

      // Delete the read receipt for this message to mark it as unread
      await supabase
        .from("thread_message_receipts")
        .delete()
        .eq("message_id", latest.id)
        .eq("user_id", me.id);

      // Update conversation unread count
      setConversations(prev => prev.map(c => 
        c.threadId === selectedConversation.threadId 
          ? { ...c, unreadCount: Math.max(1, c.unreadCount) } 
          : c
      ));

      try { readEventsChannel?.send({ type: 'broadcast', event: 'mark_unread', payload: { count: 1 } }); } catch {}
    } catch (e: any) {
      console.error("Failed to mark as unread:", e);
    }
  };

  const getRoomKeyForCall = (otherUserId: number) => {
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user session");
    const me = JSON.parse(userData);
    const a = Math.min(me.id, otherUserId);
    const b = Math.max(me.id, otherUserId);
    return `call:dm:${a}-${b}`;
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedConversation) return;
    try {
      const roomKey = getRoomKeyForCall(selectedConversation.participantId);
      await startContextCall(roomKey, type, selectedConversation.participantId);
      navigate(`/call/${type}/${encodeURIComponent(roomKey)}`);
    } catch (e: any) {
      toast({ title: 'Call error', description: e.message || 'Failed to start call', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full flex">
        {/* Conversation List */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium">💬</span>
              </div>
              <div>
                <h2 className="font-semibold">Chat</h2>
                <p className="text-xs text-muted-foreground">Search and select a conversation</p>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations" className="pl-9" />
            </div>

            <Button onClick={() => setNewConvOpen(true)} className="w-full mb-4 bg-foreground text-background hover:bg-foreground/90">
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>

            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.threadId}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors transition-shadow relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selectedConversation?.threadId === conv.threadId
                      ? "bg-secondary text-foreground"
                      : "hover:bg-secondary/50 hover:shadow-sm active:shadow"
                  }`}
                >
                  {selectedConversation?.threadId === conv.threadId && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l" />
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${conv.unreadCount > 0 ? 'font-bold' : ''}`}>
                          {conv.participantName || `User #${conv.participantId}`}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="flex-shrink-0 h-5 min-w-[20px] px-1.5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-semibold">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.lastMessageAt).toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedConversation ? (
            <>
              <div className="border-b p-6">
                <h2 className="text-xl font-semibold">Chat with {selectedConversation.participantName || `User #${selectedConversation.participantId}`}</h2>
                <p className="text-sm text-muted-foreground">Messages and calling</p>
                {!realtimeConnected && (
                  <div className="mt-2 text-xs text-yellow-700">Reconnecting to realtime…</div>
                )}
                {realtimeError && (
                  <div className="mt-1 text-xs text-red-700">{realtimeError}</div>
                )}
              </div>

              <div className="flex-1 p-6 relative overflow-y-auto" ref={messagesScrollRef} role="log" aria-live="polite" aria-relevant="additions text" data-chat-scroll onScroll={() => {
                const el = messagesScrollRef.current;
                if (!el) return;
                const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                setIsNearBottom(near);
                if (near) setShowJumpToLatest(false);
              }}>
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No messages</p>
                  </div>
                ) : (
                  <>
                  <div className="space-y-3">
                    {(() => {
                      const userData = localStorage.getItem("user");
                      const me = userData ? JSON.parse(userData) : null;
                      const lv = lastViewedAt || "1970-01-01";
                      const lvTs = new Date(lv).getTime();
                      const meId = me?.id ?? -1;
                      const firstNewIndex = messages.findIndex(x => x.user_id !== meId && new Date(x.created_at).getTime() > lvTs);
                      return messages.map((m, idx) => (
                        <>
                          {firstNewIndex === idx && (
                            <div className="flex items-center my-2" key={`sep-${m.id}`} role="separator" aria-label="New messages">
                              <div className="h-px flex-1 bg-border"></div>
                              <span className="px-2 text-xs text-primary">New messages</span>
                              <div className="h-px flex-1 bg-border"></div>
                            </div>
                          )}
                          {(() => {
                            const isMine = m.user_id !== selectedConversation.participantId;
                            const prev = messages[idx - 1];
                            const isStart = !prev || prev.user_id !== m.user_id || (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60 * 1000;
                            return (
                              <div key={m.id} className="group relative px-3" data-chat-message data-message-id={String(m.id)} data-author-id={String(m.user_id ?? '')} style={{ marginTop: `${settings.messageGapPx}px` }}>
                                {isStart && (
                                  <div className="flex items-baseline gap-2 text-[11px] text-muted-foreground mb-1">
                                    <span className="font-medium text-foreground">{m.user_id === selectedConversation.participantId ? (selectedConversation.participantName || `User #${selectedConversation.participantId}`) : "You"}</span>
                                    <span>{new Date(m.created_at).toLocaleString()}</span>
                                    {m.updated_at && m.updated_at !== m.created_at && (
                                      <button className="ml-1 underline" onClick={async () => {
                                        try {
                                          const { data } = await supabase
                                            .from('thread_message_edits')
                                            .select('id, edited_at, editor_id, old_text, new_text')
                                            .eq('message_id', m.id)
                                            .order('edited_at', { ascending: false });
                                          setEditHistory((data as { id: number; edited_at: string; editor_id: number; old_text: string; new_text: string }[]) || []);
                                          setEditHistoryOpenId(m.id);
                                        } catch {}
                                      }}>Edited</button>
                                    )}
                                    {m.user_id !== selectedConversation.participantId && seenByOther.has(m.id) && (
                                      <span className="ml-1">Seen</span>
                                    )}
                                    {m.user_id !== null && userOwnsMessage(m.user_id) && (() => {
                                      const secondsLeft = formatEditCountdown(m.created_at, nowTick, editWindowSeconds);
                                      if (secondsLeft <= 0) return null;
                                      return <span className="ml-1">Edit available {secondsLeft}s</span>;
                                    })()}
                                  </div>
                                )}
                                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`${isMine ? 'bg-primary/5' : 'bg-secondary'} inline-block text-sm ring-1 ring-border`} style={{ borderRadius: `${settings.bubbleRadiusPx}px`, padding: `${settings.bubblePaddingY}px ${settings.bubblePaddingX}px`, maxWidth: `${settings.bubbleMaxWidthPct}%` }} data-message-id={String(m.id)} data-author-id={String(m.user_id ?? '')}> 
                                    <div>{renderFormatted(m.text)}</div>
                                  {(() => {
                                    const match = m.text.match(/\[(.+?)\]\((https?:\/\/[^)]+)\)/);
                                    const url = match?.[2] || "";
                                    const isGif = url.endsWith(".gif");
                                    const isMp4 = url.endsWith(".mp4");
                                    const isWebp = url.endsWith(".webp");
                                    if (!isGif && !isMp4 && !isWebp) return null;
                                    return (
                                  <div className="mt-2">
                                      {isMp4 ? (
                                        <video src={url} controls playsInline className="max-h-60 rounded" />
                                      ) : (
                                        <img src={url} alt="attachment" className="max-h-60 rounded" />
                                      )}
                                    </div>
                                  );
                                  })()}
                                  </div>
                                </div>
                                <div className="pointer-events-auto absolute -top-6 right-4 bg-background border rounded-full shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-10 flex items-center gap-2">
                                  {['👍','❤️','🎉','😂','😮','🙏'].map(e => (
                                    <button key={e} onClick={() => toggleReaction(m.id, e)} className="px-2 py-1 rounded-full text-sm hover:bg-secondary" aria-label={`React ${e}`}>{e}</button>
                                  ))}
                                  <button onClick={() => replyTo(m)} className="px-2 py-1 rounded-full text-sm hover:bg-secondary" aria-label="Reply"><Reply className="h-3 w-3" /></button>
                                  <button onClick={() => setEmojiOpen(true)} className="px-2 py-1 rounded-full text-sm hover:bg-secondary" aria-label="More reactions">…</button>
                                </div>
                                {(reactions[m.id] || []).length > 0 && (
                                  <div className="absolute -bottom-4 right-4 flex items-center gap-1">
                                    {(reactions[m.id] || []).map(r => (
                                      <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)} disabled={!!reactionPendingMap[m.id]?.[r.emoji]} className={`px-2 py-0.5 rounded-full text-xs ring-1 ring-border ${r.reactedByMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'} ${reactionPendingMap[m.id]?.[r.emoji] ? 'opacity-70' : ''}`}>
                                        {reactionPendingMap[m.id]?.[r.emoji] && <Loader2 className="h-3 w-3 inline-block mr-1 animate-spin" />}
                                        {r.emoji} {r.count}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {m.user_id !== null && userOwnsMessage(m.user_id) && (
                                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" variant="ghost" onClick={() => beginEdit(m)} aria-label="Edit message" disabled={!canEditMessage(m.created_at, nowTick, editWindowSeconds)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteMessage(m.id)} aria-label="Delete message">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                {editingMessageId === m.id && (
                                  <div className="mt-2 space-y-2">
                                    <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => saveEdit(m.id)}>Save</Button>
                                      <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ));
                    })()}
                  </div>
                  {(!isNearBottom && showJumpToLatest) ? (
                    <div className="fixed bottom-8 right-8">
                      <Button onClick={() => {
                        const el = messagesScrollRef.current;
                        if (!el) return;
                        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                        setShowJumpToLatest(false);
                      }} className="bg-foreground text-background hover:bg-foreground/90 shadow-lg rounded-full px-3 py-2" aria-label="Jump to latest messages">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Jump to latest
                      </Button>
                    </div>
                  ) : null}
                  </>
                )}
              </div>

              <div className="border-t p-6">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                <div className="flex gap-3 mb-4">
                  <Textarea value={messageText} onChange={handleMessageTextareaChange} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type a message" className="flex-1 min-h-[44px]" />
                  <Button type="button" onClick={() => setGifOpen(true)} size="icon" variant="outline" className="transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary" aria-label="Open GIF picker">
                    <Image className="h-4 w-4" />
                  </Button>
                  <Button type="button" onClick={() => setEmojiOpen(true)} size="icon" variant="outline" className="transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary" aria-label="Open emoji picker">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button type="button" onClick={() => fileInputRef.current?.click()} size="icon" variant="outline" className="transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary" aria-label="Attach a file">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button disabled={sending} onClick={sendMessage} size="icon" className="bg-foreground text-background hover:bg-foreground/90 transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary" aria-label="Send message">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <EmojiPicker open={emojiOpen} onOpenChange={setEmojiOpen} onSelect={(e) => setMessageText(prev => prev + e)} />
                <GifPicker open={gifOpen} onOpenChange={setGifOpen} onSelect={async (it) => {
                  try {
                    await setSessionVariables();
                    const userData = localStorage.getItem("user");
                    if (!userData || !selectedConversation) return;
                    const me = JSON.parse(userData);
                    const text = `[GIF](${it.url})`;
                    await supabase.from('thread_messages').insert({ thread_id: selectedConversation.threadId, user_id: me.id, text });
                    await fetchMessagesForDM(selectedConversation.participantId);
                  } catch {}
                }} />
                <LayoutTuner open={tunerOpen} onOpenChange={setTunerOpen} />
                {isOtherTyping && (
                  <div className="inline-flex items-center bg-secondary rounded-full px-3 py-2" role="status" aria-live="polite" aria-label="User is typing">
                    <div className="typing-dots"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => startCall('audio')} variant="default" className="bg-foreground text-background hover:bg-foreground/90">
                    <Phone className="h-4 w-4 mr-2" />
                    Start Voice Call
                  </Button>
                  <Button onClick={() => startCall('video')} variant="outline">Start Video Call</Button>
                  <Button onClick={() => handleMarkUnread()} variant="outline">Mark Unread</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start a new conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search people by name or email" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loadingMembers ? (
              <div className="py-8 text-center text-muted-foreground">Loading members...</div>
            ) : (
              <div className="space-y-6 max-h-[50vh] overflow-y-auto">
                {groupedMembers.unassigned.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Unassigned</h3>
                    <div className="space-y-2">
                      {groupedMembers.unassigned.map(m => (
                        <button key={m.id} className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary" onClick={() => startConversationWith({ id: m.id, name: m.name })}>
                          <div className="font-medium">{m.name || m.email}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {groupedMembers.byDept.map(d => (
                  <div key={d.id}>
                    <h3 className="text-sm font-semibold mb-2">{d.name}</h3>
                    <div className="space-y-2">
                      {d.members.map(m => (
                        <button key={m.id} className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary" onClick={() => startConversationWith({ id: m.id, name: m.name })}>
                          <div className="font-medium">{m.name || m.email}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedMembers.unassigned.length === 0 && groupedMembers.byDept.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">No members found</div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>



      <Dialog open={editHistoryOpenId !== null} onOpenChange={(open) => { if (!open) { setEditHistoryOpenId(null); setEditHistory([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit history</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground">No edits recorded</div>
            ) : (
              editHistory.map((h) => (
                <div key={h.id} className="text-sm">
                  <div className="text-xs text-muted-foreground">{new Date(h.edited_at).toLocaleString()}</div>
                  <div>
                    <div className="line-through opacity-70">{h.old_text}</div>
                    <div>{h.new_text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default function Chat() {
  return (
    <ProtectedRoute>
      <ChatPage />
    </ProtectedRoute>
  );
}
