import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, MapPin, Ticket, Music, Globe, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function EmbedWhiteLabelProfile() {
  const params = new URLSearchParams(window.location.search);
  const { id } = useParams();
  const theme = params.get("theme") || "dark";
  const [wl, setWl] = useState(null);
  const [artists, setArtists] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      try {
        const wls = await base44.entities.WhiteLabel.filter({ id }, null, 1);
        const record = wls[0];
        if (!record) { setLoading(false); return; }
        setWl(record);

        // ── Managed artists (managed_artist_ids = Artist entity IDs) ──
        const artistIds = (record.managed_artist_ids || []).slice(0, 12);
        let managedArtists = [];
        if (artistIds.length) {
          const found = await Promise.all(
            artistIds.map(aid => base44.entities.Artist.get(aid).catch(() => null))
          );
          managedArtists = found.filter(Boolean);
        }
        setArtists(managedArtists);

        // ── Managed organizers' upcoming events ──
        // Resolve organizer user IDs robustly: managed_organizer_ids may store either
        // OrganizerProfile entity IDs or user IDs. Try both so we never leak data
        // belonging to another white label.
        const orgIds = (record.managed_organizer_ids || []).slice(0, 12);
        let orgUserIds = [];
        if (orgIds.length) {
          const profiles = await Promise.all(
            orgIds.map(async (x) => {
              let p = await base44.entities.OrganizerProfile.get(x).catch(() => null);
              if (!p) {
                const arr = await base44.entities.OrganizerProfile.filter({ organizer_id: x }, null, 1).catch(() => []);
                p = arr[0];
              }
              return p;
            })
          );
          orgUserIds = [...new Set(profiles.filter(Boolean).map(p => p.organizer_id).filter(Boolean))];
        }

        let managedEvents = [];
        if (orgUserIds.length) {
          const results = await Promise.all(
            orgUserIds.map(uid =>
              base44.entities.Event.filter({ organizer_id: uid, status: "published" }, "date", 12).catch(() => [])
            )
          );
          const now = Date.now();
          managedEvents = results
            .flat()
            .filter(e => e.date && new Date(e.date).getTime() > now)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 12);
        }
        setEvents(managedEvents);
      } catch (e) {
        // swallow — render empty state
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isDark = theme !== "light";
  const bg = isDark ? "#0a0d18" : "#ffffff";
  const cardBg = isDark ? "#111827" : "#f9fafb";
  const border = isDark ? "#1e2a3a" : "#e5e7eb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const muted = isDark ? "#94a3b8" : "#6b7280";
  const accent = "#ff1b8d";
  const origin = window.location.origin;

  if (loading) return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!wl) return (
    <div style={{ background: bg, color: muted, fontFamily: "Inter, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <p style={{ fontSize: 14 }}>White label profile not found.</p>
    </div>
  );

  const brandName = wl.brand_name || wl.name || "White Label";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: 16, minHeight: "100vh", boxSizing: "border-box" }}>
      {/* ── Brand header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${border}`, marginBottom: 16 }}>
        {wl.logo_url ? (
          <img src={wl.logo_url} alt={brandName} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${border}` }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${accent}22`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
            {brandName[0] || "W"}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 18, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</p>
          {wl.domain && <p style={{ fontSize: 12, color: muted, margin: "2px 0 0", fontFamily: "monospace" }}>{wl.domain}</p>}
        </div>
        {wl.is_active && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "3px 8px", borderRadius: 6, flexShrink: 0, fontFamily: "monospace" }}>Active</span>
        )}
      </div>

      {/* ── Upcoming events ── */}
      <SectionTitle label="Upcoming Events" muted={muted} />
      {events.length === 0 ? (
        <EmptyHint text="No upcoming events" muted={muted} icon="calendar" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map(ev => (
            <a key={ev.id} href={`${origin}/events/${ev.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {ev.cover_image && (
                  <img src={ev.cover_image} alt={ev.title} style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
                    {ev.date && (
                      <span style={{ fontSize: 12, color: muted, display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar style={{ width: 12, height: 12 }} />
                        {format(new Date(ev.date), "MMM d, yyyy")}
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
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}22`, padding: "3px 8px", borderRadius: 6, flexShrink: 0, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  <Ticket style={{ width: 10, height: 10 }} /> Tickets
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* ── Managed artists ── */}
      {artists.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <SectionTitle label="Artists" muted={muted} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {artists.map(a => (
              <a key={a.id} href={`${origin}/artists/${a.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                {a.profile_image ? (
                  <img src={a.profile_image} alt={a.display_name} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", marginBottom: 8 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${accent}22`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Music style={{ width: 20, height: 20 }} />
                  </div>
                )}
                <p style={{ fontWeight: 700, fontSize: 13, color: text, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{a.display_name}</p>
                {a.genre && <p style={{ fontSize: 11, color: muted, margin: "2px 0 0", fontFamily: "monospace", textTransform: "capitalize" }}>{a.genre.replace(/_/g, " ")}</p>}
              </a>
            ))}
          </div>
        </>
      )}

      {/* ── Powered by Reizor ── */}
      <div style={{ textAlign: "center", marginTop: 20, paddingTop: 14, borderTop: `1px solid ${border}` }}>
        <a href={origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: muted, textDecoration: "none", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
          Powered by <span style={{ color: accent, fontWeight: 800 }}>Reizor</span>
          <ExternalLink style={{ width: 10, height: 10, opacity: 0.6 }} />
        </a>
      </div>
    </div>
  );
}

function SectionTitle({ label, muted }) {
  return <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: muted, margin: "0 0 10px", fontFamily: "monospace" }}>{label}</p>;
}

function EmptyHint({ text, muted }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <p style={{ color: muted, fontSize: 13, margin: 0 }}>{text}</p>
    </div>
  );
}