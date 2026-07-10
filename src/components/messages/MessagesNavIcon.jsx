import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * MessagesNavIcon — desktop navbar icon linking to the global inbox,
 * with an unread badge for the current user.
 */
export default function MessagesNavIcon() {
  const [unread, setUnread] = useState(0);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const authed = await base44.auth.isAuthenticated().catch(() => false);
      if (!authed) return;
      const u = await base44.auth.me().catch(() => null);
      if (!u || !alive) return;
      setEmail(u.email);
      const [asArtist, asFan] = await Promise.all([
        base44.entities.Message.filter({ artist_email: u.email }, "-created_date", 500).catch(() => []),
        base44.entities.Message.filter({ fan_email: u.email }, "-created_date", 500).catch(() => []),
      ]);
      if (!alive) return;
      const seen = new Set();
      let count = 0;
      [...asArtist, ...asFan].forEach((m) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        if (!m.read && m.sender_email !== u.email) count++;
      });
      setUnread(count);
    };
    run();
    // Refresh when the tab regains focus or a new message notification may have arrived
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; window.removeEventListener("focus", onFocus); };
  }, []);

  if (!email) return null;

  return (
    <Link to="/messages" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors" title="Messages" aria-label="Messages">
      <Mail className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}