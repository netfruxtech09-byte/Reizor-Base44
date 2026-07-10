import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function EmbedArtistTour() {
  const params = new URLSearchParams(window.location.search);
  const { id: artistId } = useParams();
  const theme = params.get("theme") || "dark";
  const [shows, setShows] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ArtistTourSchedule.filter({ artist_id: artistId }, "show_date", 20).catch(() => []),
      base44.entities.Artist.list(null, 100).then(all => all.filter(a => a.id === artistId)).catch(() => []),
    ]).then(([tour, artists]) => {
      const now = new Date();
      setShows(tour.filter(s => s.show_date && new Date(s.show_date) >= now));
      setArtist(artists[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [artistId]);

  const isDark = theme !== "light";
  const bg = isDark ? "#0a0d18" : "#ffffff";
  const cardBg = isDark ? "#111827" : "#f9fafb";
  const border = isDark ? "#1e2a3a" : "#e5e7eb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const muted = isDark ? "#94a3b8" : "#6b7280";
  const accent = "#ff1b8d";

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      {artist && (
        <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: text }}>{artist.display_name} — Tour Dates</p>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: muted }}>Loading…</div>
      ) : shows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Calendar style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.3, color: muted }} />
          <p style={{ color: muted, fontSize: 14 }}>No upcoming tour dates</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shows.map(show => (
            <div key={show.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: accent, margin: 0, lineHeight: 1 }}>{format(new Date(show.show_date), "d")}</p>
                <p style={{ fontSize: 10, color: muted, fontFamily: "monospace", textTransform: "uppercase", margin: 0 }}>{format(new Date(show.show_date), "MMM")}</p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{show.event_name || show.venue}</p>
                <p style={{ fontSize: 12, color: muted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <MapPin style={{ width: 11, height: 11, flexShrink: 0 }} />{[show.venue, show.city, show.country].filter(Boolean).join(", ")}
                </p>
              </div>
              {show.ticket_url && (
                <a href={show.ticket_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}22`, padding: "4px 8px", borderRadius: 6, textDecoration: "none", fontFamily: "monospace", flexShrink: 0 }}>
                  Tickets
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: muted, textDecoration: "none", fontFamily: "monospace" }}>
          Powered by Reizor
        </a>
      </div>
    </div>
  );
}