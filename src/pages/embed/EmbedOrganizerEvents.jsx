import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { format } from "date-fns";

export default function EmbedOrganizerEvents() {
  const params = new URLSearchParams(window.location.search);
  const { id: organizerId } = useParams();
  const theme = params.get("theme") || "dark";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Event.filter(
      { organizer_id: organizerId, status: "published" },
      "date",
      10
    ).then(evs => {
      const upcoming = evs.filter(e => e.date && new Date(e.date) > new Date());
      setEvents(upcoming);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [organizerId]);

  const isDark = theme !== "light";
  const bg = isDark ? "#0a0d18" : "#ffffff";
  const cardBg = isDark ? "#111827" : "#f9fafb";
  const border = isDark ? "#1e2a3a" : "#e5e7eb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const muted = isDark ? "#94a3b8" : "#6b7280";
  const accent = "#ff1b8d";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: muted }}>Loading events…</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Calendar style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ color: muted, fontSize: 14 }}>No upcoming events</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map(ev => (
            <a
              key={ev.id}
              href={`${window.location.origin}/events/${ev.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", display: "block", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", transition: "border-color 0.2s" }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {ev.cover_image && (
                  <img src={ev.cover_image} alt={ev.title} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
                    {ev.date && (
                      <span style={{ fontSize: 12, color: muted, display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar style={{ width: 12, height: 12 }} />
                        {format(new Date(ev.date), "MMM d, yyyy · h:mm a")}
                      </span>
                    )}
                    {(ev.venue_name || ev.city) && (
                      <span style={{ fontSize: 12, color: muted, display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin style={{ width: 12, height: 12 }} />
                        {[ev.venue_name, ev.city].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}22`, padding: "3px 8px", borderRadius: 6, flexShrink: 0, fontFamily: "monospace" }}>
                  <Ticket style={{ width: 10, height: 10, display: "inline", marginRight: 3 }} />
                  Tickets
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: muted, textDecoration: "none", fontFamily: "monospace" }}>
          Powered by Reizor
        </a>
      </div>
    </div>
  );
}