import { useState, useEffect, useRef, Fragment } from "react";
import { Bell, X, Ticket, Zap, Star, Info, Check, CheckCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/AuthContext";

const TYPE_CONFIG = {
  event_update: { icon: Zap, color: "text-accent", bg: "bg-accent/10" },
  ticket_available: { icon: Ticket, color: "text-primary", bg: "bg-primary/10" },
  recommendation: { icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  general: { icon: Info, color: "text-muted-foreground", bg: "bg-muted" },
  post_published: { icon: Zap, color: "text-primary", bg: "bg-primary/10" },
  prize_won: { icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" },
};

const MESSAGE_CLAMP_LENGTH = 140;

function NotificationItem({ n, cfg, Icon, safeLink, onClick, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const message = n.message || "";
  const isLong = message.length > MESSAGE_CLAMP_LENGTH;

  const content = (
    <div className={`relative flex gap-2 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer pr-10 ${!n.is_read ? "bg-primary/5" : ""}`}>
      {!n.is_read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary pointer-events-none" />
      )}
      <div className={`mt-0.5 w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0 pr-1">
        <p className={`text-sm font-semibold leading-tight break-words ${n.is_read ? "text-foreground/70" : "text-foreground"}`}>
          {n.title}
        </p>
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
        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
          {formatDistanceToNow(
            (() => { const s = String(n.created_date || ""); return new Date(/[Z+\-]\d*$/.test(s.replace(/\.\d+$/, "")) ? s : s + "Z"); })(),
            { addSuffix: true }
          )}
        </p>
      </div>
      <button
        onClick={(e) => onDismiss(e, n)}
        className="absolute top-2 right-2 p-1.5 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors touch-manipulation flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return safeLink ? (
    <Link to={safeLink} onClick={onClick}>{content}</Link>
  ) : (
    <div onClick={onClick}>{content}</div>
  );
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications(user);
  }, [user?.email]);

  // Polling every 20s to guarantee real-time feel even if websocket misses events
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadNotifications(user), 20000);
    return () => clearInterval(interval);
  }, [user?.email]);

  useEffect(() => {
    if (!user) return;
    const accountCreated = user.created_date ? new Date(user.created_date) : null;
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.data?.user_email !== user.email) return;
      if (event.type === "create") {
        // Only show if notification was created after the account was created
        const nDate = event.data?.created_date ? new Date(event.data.created_date) : null;
        if (accountCreated && nDate && nDate < accountCreated) return;
        // Prevent duplicates: check if this notification already exists in the list
        setNotifications((prev) => {
          const isDuplicate = prev.some(n => 
            n.title === event.data.title && 
            n.message === event.data.message && 
            n.user_email === event.data.user_email &&
            Math.abs(new Date(n.created_date).getTime() - new Date(event.data.created_date).getTime()) < 1000
          );
          return isDuplicate ? prev : [event.data, ...prev];
        });
      } else if (event.type === "update") {
        setNotifications((prev) => prev.map((n) => n.id === event.id ? event.data : n));
      } else if (event.type === "delete") {
        setNotifications((prev) => prev.filter((n) => n.id !== event.id));
      }
    });
    return unsub;
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadNotifications(u) {
    try {
      const data = await base44.entities.Notification.filter({ user_email: u.email }, "-created_date", 50);
      if (!Array.isArray(data)) { setNotifications([]); return; }

      // Only show notifications created AFTER the user's account was created.
      // This prevents new signups from seeing old blasts/event updates sent before they existed.
      const accountCreated = u.created_date ? new Date(u.created_date) : null;
      const filtered = accountCreated
        ? data.filter((n) => {
            const nDate = n.created_date ? new Date(n.created_date) : null;
            return nDate && nDate >= accountCreated;
          })
        : data;

      // Remove duplicates: keep only the latest version of each unique notification
      const deduplicated = [];
      const seen = new Set();
      for (const n of filtered) {
        const key = `${n.title}|${n.message}`;
        if (!seen.has(key)) {
          deduplicated.push(n);
          seen.add(key);
        }
      }

      setNotifications(deduplicated);
    } catch {}
  }

  async function markRead(n) {
    if (n.is_read) return;
    await base44.entities.Notification.update(n.id, { is_read: true });
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true })));
  }

  async function dismiss(e, n) {
    e.stopPropagation();
    e.preventDefault();
    await base44.entities.Notification.delete(n.id);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] font-bold font-mono flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed lg:absolute left-4 right-4 lg:left-auto lg:right-0 top-20 lg:top-full lg:mt-2 w-auto lg:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-[calc(100vh-100px)] lg:max-h-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-display font-bold text-sm tracking-wide">NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-mono font-bold rounded">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 -mr-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground touch-manipulation"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-border/30 max-h-[calc(100vh-180px)] lg:max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Bell className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
                const Icon = cfg.icon;
                // Ensure link always starts with / to avoid relative-path 404s
                const safeLink = n.link ? (n.link.startsWith("/") ? n.link : `/${n.link}`) : null;

                const handleClick = () => {
                  // Mark read once — no double-fire
                  if (!n.is_read) markRead(n);
                  setOpen(false);
                };

                return (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    cfg={cfg}
                    Icon={Icon}
                    safeLink={safeLink}
                    onClick={handleClick}
                    onDismiss={dismiss}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}