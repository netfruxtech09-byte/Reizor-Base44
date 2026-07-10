import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday } from "date-fns";

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

/**
 * ConversationList — left rail of the global Messages inbox.
 * Lists all conversations for the current user, grouped by thread.
 */
export default function ConversationList({ conversations, activeThreadId, onSelect, search, onSearch, currentEmail }) {
  return (
    <div className="flex flex-col h-full bg-card border border-border/50 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm bg-secondary border-border/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/20">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
          </div>
        )}

        {conversations.map((c) => {
          const isArtistSide = currentEmail === c.artist_email;
          const otherName = isArtistSide ? c.fan_name || c.fan_email : c.artist_name || "Artist";
          const last = c.messages[c.messages.length - 1];
          const isSelected = activeThreadId === c.thread_id;
          return (
            <button
              key={c.thread_id}
              onClick={() => onSelect(c.thread_id)}
              className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10" : ""}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                  {(otherName || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm font-bold truncate ${c.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {otherName}
                    </p>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{last?.body || ""}</p>
                  {last && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeLabel(last.created_date)}</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}