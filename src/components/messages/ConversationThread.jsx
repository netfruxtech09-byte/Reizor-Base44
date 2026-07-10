import { useRef, useEffect, useState } from "react";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

/**
 * ConversationThread — right pane of the global Messages inbox.
 * Shows the full message thread and a reply box that calls the backend function.
 */
export default function ConversationThread({ conversation, currentEmail, onReply, sending, onBack }) {
  const [reply, setReply] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  if (!conversation) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-card border border-border/50 rounded-xl">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Select a conversation</p>
        </div>
      </div>
    );
  }

  const isArtistSide = currentEmail === conversation.artist_email;
  const otherName = isArtistSide ? conversation.fan_name || conversation.fan_email : conversation.artist_name || "Artist";
  const otherSub = isArtistSide ? conversation.fan_email : "Artist";

  const submit = () => {
    const text = reply.trim();
    if (!text || sending) return;
    onReply(text);
    setReply("");
  };

  return (
    <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <button onClick={onBack} className="md:hidden p-1 rounded hover:bg-muted transition-colors" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary shrink-0">
          {(otherName || "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{otherName}</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{otherSub}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.messages.map((msg) => {
          const isMine = msg.sender_email === currentEmail;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm ${
                isMine
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              }`}>
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {format(new Date(msg.created_date), "MMM d, h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      <div className="p-3 border-t border-border/30 flex gap-2">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Type a reply..."
          className="bg-secondary border-border/50 text-sm"
        />
        <Button onClick={submit} disabled={!reply.trim() || sending} size="icon" className="shrink-0 glow-lime">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}