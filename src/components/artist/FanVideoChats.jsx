import { useState, useEffect } from "react";
import { Video, Clock, Users, PlayCircle, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import VideoChatRoom from "./VideoChatRoom";

export default function FanVideoChats({ artist, user }) {
  const [chats, setChats] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.VideoChat.filter({ artist_id: artist.id }, "-created_date", 20).then(setChats);
    if (user) {
      base44.entities.FanSubscription.filter({ artist_id: artist.id, fan_email: user.email, status: "active" }, null, 10).then(setSubscriptions);
    }
    setLoading(false);
  }, [artist.id, user?.email]);

  const canJoin = (chat) => {
    if (!user) return false;
    // No tier restriction = all active subscribers
    if (!chat.allowed_tier_ids || chat.allowed_tier_ids.length === 0) {
      return subscriptions.length > 0;
    }
    return subscriptions.some(s => chat.allowed_tier_ids.includes(s.tier_id));
  };

  const visibleChats = chats.filter(c => c.status === "live" || c.status === "scheduled");
  if (loading || visibleChats.length === 0) return null;

  if (activeRoom) return (
    <VideoChatRoom
      room={activeRoom}
      displayName={user?.full_name || "Fan"}
      onLeave={() => setActiveRoom(null)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-lg">VIDEO SESSIONS</h2>
      </div>
      <div className="space-y-2">
        {visibleChats.map(chat => {
          const isLive = chat.status === "live";
          const access = canJoin(chat);
          const tierNames = chat.allowed_tier_names?.length ? chat.allowed_tier_names.join(", ") : "All subscribers";

          return (
            <div key={chat.id} className={`p-4 rounded-xl border transition-all ${isLive ? "bg-green-400/5 border-green-400/30" : "bg-card border-border/50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Video className={`w-4 h-4 ${isLive ? "text-green-400" : "text-muted-foreground"}`} />
                    <p className="font-display font-bold text-sm">{chat.title}</p>
                    {isLive && (
                      <span className="font-mono text-[10px] font-bold uppercase text-green-400 bg-green-400/10 px-2 py-0.5 rounded animate-pulse">LIVE NOW</span>
                    )}
                  </div>
                  {chat.description && <p className="text-xs text-muted-foreground mt-0.5">{chat.description}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {chat.scheduled_at && !isLive && (
                      <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        <Clock className="w-3 h-3" /> {format(new Date(chat.scheduled_at), "MMM dd · h:mm a")}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      <Users className="w-3 h-3" /> {tierNames}
                    </span>
                  </div>
                </div>
                {isLive && (
                  access ? (
                    <button onClick={() => setActiveRoom(chat)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-400 text-black text-xs font-display font-bold hover:bg-green-300 transition-colors shrink-0">
                      <PlayCircle className="w-4 h-4" /> Join
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-mono shrink-0">
                      <Lock className="w-3.5 h-3.5" /> {user ? "Upgrade tier" : "Sign in"}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}