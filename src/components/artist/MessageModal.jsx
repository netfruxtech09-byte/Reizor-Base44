import { useState, useEffect } from "react";
import { X, Send, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ModalPortal from "@/components/shared/ModalPortal";

export default function MessageModal({ artist, user, onClose }) {
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [existingThread, setExistingThread] = useState(null);
  const [checking, setChecking] = useState(true);

  // Detect an existing conversation so we offer "Open Conversation" instead of a duplicate chat
  useEffect(() => {
    let alive = true;
    if (!user || !artist) { setChecking(false); return; }
    base44.entities.Message.filter({ artist_id: artist.id, fan_email: user.email }, null, 1)
      .then((rows) => { if (alive) { setExistingThread(rows[0]?.thread_id || null); setChecking(false); } })
      .catch(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [user, artist]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    if (!user) { base44.auth.redirectToLogin(); return; }
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendArtistMessage", { artist_id: artist.id, body: text });
      toast.success(`Message sent to ${artist.display_name}!`);
      onClose();
      const threadId = res?.data?.thread_id;
      if (threadId) navigate(`/messages?thread=${encodeURIComponent(threadId)}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not send message. Please try again.");
      setSending(false);
    }
  };

  const openConversation = () => {
    if (existingThread) navigate(`/messages?thread=${encodeURIComponent(existingThread)}`);
    onClose();
  };

  const isSelf = user && artist && user.email === artist.user_email;

  return (
    <ModalPortal open={true} onBackdropClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {artist.profile_image ? (
              <img src={artist.profile_image} className="w-9 h-9 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                {artist.display_name?.[0]}
              </div>
            )}
            <div>
              <p className="font-display font-bold text-sm">{artist.display_name}</p>
              <p className="text-[10px] font-mono text-muted-foreground">
                {existingThread ? "Continue conversation" : "Send a message"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSelf ? (
          <p className="text-sm text-muted-foreground text-center py-2">This is your artist profile.</p>
        ) : checking ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : existingThread ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">You already have a conversation with {artist.display_name}. Open it to continue chatting.</p>
            <Button onClick={openConversation} className="w-full glow-lime font-display font-bold gap-2">
              <MessageSquare className="w-4 h-4" /> Open Conversation
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">Cancel</Button>
          </div>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && handleSend()}
              placeholder={`Ask ${artist.display_name} about tickets, events, or collabs...`}
              rows={4}
              autoFocus
              className="w-full rounded-xl bg-secondary border border-border/50 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={!body.trim() || sending} className="flex-1 glow-lime font-display font-bold gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending..." : "Send Message"}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </ModalPortal>
  );
}