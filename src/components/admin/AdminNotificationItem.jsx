import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink } from "lucide-react";
import { getRelativeTime } from "@/utils/getRelativeTime";

const MESSAGE_CLAMP_LENGTH = 140;

export default function AdminNotificationItem({ notif, onMarkRead, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const message = notif.message || "";
  const isLong = message.length > MESSAGE_CLAMP_LENGTH;

  const handleClick = () => {
    if (!notif.is_read) onMarkRead(notif);
    if (notif.link) onClose();
  };

  const content = (
    <div
      onClick={handleClick}
      className={`px-4 py-3 transition-colors cursor-pointer hover:bg-muted/30 ${!notif.is_read ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {!notif.is_read && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
            <p className={`text-sm font-semibold break-words ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>
              {notif.title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug whitespace-pre-line break-words">
            {isLong && !expanded ? `${message.slice(0, MESSAGE_CLAMP_LENGTH)}…` : message}
          </p>
          {isLong && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
              className="text-[10px] font-mono font-bold text-primary hover:underline mt-1"
            >
              {expanded ? "Read less" : "Read more"}
            </button>
          )}
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">
            {getRelativeTime(notif.created_date)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {notif.link && <ExternalLink className="w-3.5 h-3.5 text-accent" />}
          {!notif.is_read && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkRead(notif); }}
              className="p-1 rounded hover:bg-green-400/10 transition-colors"
              title="Mark as read"
            >
              <Check className="w-3.5 h-3.5 text-green-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return notif.link ? (
    <Link to={notif.link} className="block">{content}</Link>
  ) : content;
}