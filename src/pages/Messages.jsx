import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ConversationList from "@/components/messages/ConversationList";
import ConversationThread from "@/components/messages/ConversationThread";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const u = await base44.auth.me().catch(() => null);
    if (!u) {
      base44.auth.redirectToLogin("/messages");
      return;
    }
    setUser(u);
    const [asArtist, asFan] = await Promise.all([
      base44.entities.Message.filter({ artist_email: u.email }, "-created_date", 500).catch(() => []),
      base44.entities.Message.filter({ fan_email: u.email }, "-created_date", 500).catch(() => []),
    ]);
    const seen = new Map();
    [...asArtist, ...asFan].forEach((m) => seen.set(m.id, m));
    setMessages(Array.from(seen.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Realtime: refresh when any Message entity changes
    const unsubscribe = base44.entities.Message.subscribe(() => { load(); });
    return () => { try { unsubscribe(); } catch {} };
  }, [load]);

  // Group messages into conversations
  const conversations = useMemo(() => {
    if (!user) return [];
    const map = {};
    messages.forEach((m) => {
      if (!map[m.thread_id]) {
        map[m.thread_id] = {
          thread_id: m.thread_id,
          artist_id: m.artist_id,
          artist_name: m.artist_name,
          artist_email: m.artist_email,
          fan_email: m.fan_email,
          fan_name: m.fan_name,
          messages: [],
          unread: 0,
          last_date: "",
        };
      }
      const c = map[m.thread_id];
      c.messages.push(m);
      if (!m.read && m.sender_email !== user.email) c.unread++;
      if (m.created_date > c.last_date) c.last_date = m.created_date;
    });
    Object.values(map).forEach((c) => c.messages.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")));
    return Object.values(map).sort((a, b) => (b.last_date || "").localeCompare(a.last_date || ""));
  }, [messages, user]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // Deep link: open a specific thread or one with a given artist
  useEffect(() => {
    if (conversations.length === 0) return;
    const thread = searchParams.get("thread");
    const artist = searchParams.get("artist");
    if (thread) {
      setActiveThreadId(thread);
    } else if (artist) {
      const found = conversations.find((c) => c.artist_id === artist);
      if (found) setActiveThreadId(found.thread_id);
    }
  }, [conversations, searchParams]);

  const activeConversation = conversations.find((c) => c.thread_id === activeThreadId) || null;

  // Mark unread messages in the active thread as read
  useEffect(() => {
    if (!activeConversation || !user) return;
    const unread = activeConversation.messages.filter((m) => !m.read && m.sender_email !== user.email);
    if (unread.length === 0) return;
    Promise.all(unread.map((m) => base44.entities.Message.update(m.id, { read: true }).catch(() => {}))).then(() => {
      setMessages((prev) => prev.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read: true } : m)));
    });
  }, [activeThreadId, activeConversation, user]);

  const selectThread = (threadId) => {
    setActiveThreadId(threadId);
    setSearchParams((p) => { p.set("thread", threadId); return p; });
  };

  const handleReply = async (text) => {
    if (!activeConversation) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("replyInConversation", { thread_id: activeConversation.thread_id, body: text });
      const newMsg = res?.data?.message;
      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      } else {
        load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const isArtistSide = user?.email === c.artist_email;
    const name = (isArtistSide ? c.fan_name || c.fan_email : c.artist_name || "Artist").toLowerCase();
    return name.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-4 md:px-6 pb-10">
      <div className="flex items-center gap-3 pt-2 safe-top-header" data-safe-top>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight">MESSAGES</h1>
          {totalUnread > 0 && <p className="text-xs font-mono text-primary mt-0.5">{totalUnread} unread</p>}
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-display font-bold text-lg">No conversations yet</p>
          <p className="text-sm mt-1">Message an artist from their profile to start a conversation.</p>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[480px]">
          <div className={`${activeThreadId ? "hidden md:flex w-72 shrink-0" : "flex-1 md:w-72 md:flex-none md:shrink-0"}`}>
            <ConversationList
              conversations={filtered}
              activeThreadId={activeThreadId}
              onSelect={selectThread}
              search={search}
              onSearch={setSearch}
              currentEmail={user?.email}
            />
          </div>
          <div className={activeThreadId ? "flex-1 flex" : "hidden md:flex flex-1"}>
            <ConversationThread
              conversation={activeConversation}
              currentEmail={user?.email}
              onReply={handleReply}
              sending={sending}
              onBack={() => { setActiveThreadId(null); setSearchParams({}); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}