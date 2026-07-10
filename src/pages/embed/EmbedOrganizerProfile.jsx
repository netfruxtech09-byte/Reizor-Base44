import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, MapPin, ExternalLink } from "lucide-react";

export default function EmbedOrganizerProfile() {
  const params = new URLSearchParams(window.location.search);
  const { id: organizerId } = useParams();
  const theme = params.get("theme") || "dark";
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.OrganizerProfile.filter({ organizer_id: organizerId }, null, 1).catch(() => []),
      base44.entities.Event.filter({ organizer_id: organizerId, status: "published" }, "date", 3).catch(() => []),
    ]).then(([profiles, evs]) => {
      setProfile(profiles[0] || null);
      setEvents(evs.filter(e => e.date && new Date(e.date) > new Date()));
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

  if (loading) return (
    <div style={{ background: bg, color: muted, fontFamily: "Inter, sans-serif", padding: 16, textAlign: "center", paddingTop: 40 }}>Loading…</div>
  );

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
        {profile?.banner_image && (
          <img src={profile.banner_image} alt="Banner" style={{ width: "100%", height: 80, objectFit: "cover" }} />
        )}
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Logo" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: `2px solid ${accent}44`, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Calendar style={{ width: 22, height: 22, color: accent }} />
              </div>
            )}
            <div>
              <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: text }}>{profile?.company_name || "Event Organizer"}</p>
              {profile?.city && (
                <p style={{ fontSize: 12, color: muted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin style={{ width: 11, height: 11 }} />{profile.city}
                </p>
              )}
            </div>
          </div>
          {profile?.bio && (
            <p style={{ fontSize: 13, color: muted, marginTop: 10, lineHeight: 1.5, margin: "10px 0 0" }}>{profile.bio}</p>
          )}
          {events.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, color: muted, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Upcoming Events</p>
              {events.map(ev => (
                <a key={ev.id} href={`${window.location.origin}/events/${ev.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", textDecoration: "none", borderBottom: `1px solid ${border}` }}>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                  <ExternalLink style={{ width: 11, height: 11, color: muted, flexShrink: 0 }} />
                </a>
              ))}
            </div>
          )}
          <a href={`${window.location.origin}/organizers/${organizerId}`} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", marginTop: 12, textAlign: "center", padding: "8px 0", background: `${accent}22`, borderRadius: 8, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "monospace" }}>
            View Full Profile →
          </a>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: muted, textDecoration: "none", fontFamily: "monospace" }}>
          Powered by Reizor
        </a>
      </div>
    </div>
  );
}