import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ArrowLeft, Search, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function ArtistInbox() {
  const [artist, setArtist] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const msgs = await base44.entities.Message.filter({ artist_id: a.id }, "created_date", 500);
      setMessages(msgs);
      // Build threads grouped by fan_email
      const threadMap = {};
      msgs.forEach(m => {
        if (!threadMap[m.fan_email]) {
          threadMap[m.fan_email] = { fan_email: m.fan_email, fan_name: m.fan_name, thread_id: m.thread_id, messages: [], unread: 0 };
        }
        threadMap[m.fan_email].messages.push(m);
        if (!m.read && m.sender_email !== a.user_email) threadMap[m.fan_email].unread++;
      });
      const sorted = Object.values(threadMap).sort((a, b) => {
        const aLast = a.messages[a.messages.length - 1]?.created_date || "";
        const bLast = b.messages[b.messages.length - 1]?.created_date || "";
        return bLast.localeCompare(aLast);
      });
      setThreads(sorted);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedThread, messages]);

  const selectThread = async (thread) => {
    setSelectedThread(thread);
    // Mark fan messages as read
    const unread = thread.messages.filter(m => !m.read && m.sender_email !== artist.user_email);
    await Promise.all(unread.map(m => base44.entities.Message.update(m.id, { read: true })));
    setThreads(prev => prev.map(t => t.fan_email === thread.fan_email ? { ...t, unread: 0 } : t));
  };

  const handleSend = async () => {
    const body = reply.trim();
    if (!body || !selectedThread) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("replyInConversation", { thread_id: selectedThread.thread_id, body });
      const msg = res?.data?.message;
      if (!msg) throw new Error("No message returned");
      const updatedMessages = [...messages, msg];
      setMessages(updatedMessages);
      setSelectedThread(t => ({ ...t, messages: [...t.messages, msg] }));
      setThreads(prev => prev.map(t => t.fan_email === selectedThread.fan_email
        ? { ...t, messages: [...t.messages, msg] }
        : t
      ));
      setReply("");
    } catch (e) {
      // keep reply text so the artist can retry
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter(t =>
    t.fan_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.fan_email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">INBOX</h1>
          {totalUnread > 0 && <p className="text-xs font-mono text-primary mt-0.5">{totalUnread} unread message{totalUnread !== 1 ? "s" : ""}</p>}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Thread list */}
        <div className={`flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden ${selectedThread ? "hidden md:flex w-72 shrink-0" : "flex-1 md:w-72 md:flex-none md:shrink-0"}`}>
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fans..." className="pl-8 h-8 text-sm bg-secondary border-border/50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {filteredThreads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{threads.length === 0 ? "No messages yet" : "No results"}</p>
              </div>
            )}
            {filteredThreads.map(thread => {
              const last = thread.messages[thread.messages.length - 1];
              const isSelected = selectedThread?.fan_email === thread.fan_email;
              return (
                <button key={thread.fan_email} onClick={() => selectThread(thread)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10" : ""}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                      {thread.fan_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm font-bold truncate ${thread.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {thread.fan_name || thread.fan_email}
                        </p>
                        {thread.unread > 0 && (
                          <span className="shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white">{thread.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{last?.body}</p>
                      {last && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(new Date(last.created_date), "MMM d, h:mm a")}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message thread */}
        {selectedThread ? (
          <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden">
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <button onClick={() => setSelectedThread(null)} className="md:hidden p-1 rounded hover:bg-muted transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary">
                {selectedThread.fan_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-bold text-sm">{selectedThread.fan_name || selectedThread.fan_email}</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedThread.fan_email}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedThread.messages.map(msg => {
                const isArtist = msg.sender_email === artist.user_email;
                return (
                  <div key={msg.id} className={`flex ${isArtist ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      isArtist
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}>
                      <p>{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${isArtist ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_date), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div className="p-3 border-t border-border/30 flex gap-2">
              <Input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type a reply..."
                className="bg-secondary border-border/50 text-sm"
              />
              <Button onClick={handleSend} disabled={!reply.trim() || sending} size="icon" className="shrink-0 glow-lime">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-card border border-border/50 rounded-xl">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}