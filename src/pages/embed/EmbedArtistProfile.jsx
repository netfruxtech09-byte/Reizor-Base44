import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Music, ExternalLink } from "lucide-react";

export default function EmbedArtistProfile() {
  const params = new URLSearchParams(window.location.search);
  const { id: artistId } = useParams();
  const theme = params.get("theme") || "dark";
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Artist.filter({ id: artistId }, null, 1).catch(() =>
      base44.entities.Artist.list(null, 100).then(all => all.filter(a => a.id === artistId).slice(0,1))
    ).then(artists => {
      const a = artists[0] || null;
      if (a && a.approval_status !== "approved") { setLoading(false); return; }
      setArtist(a);
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

  if (loading) return <div style={{ background: bg, color: muted, fontFamily: "Inter, sans-serif", padding: 16, textAlign: "center", paddingTop: 40 }}>Loading…</div>;
  if (!artist) return <div style={{ background: bg, color: muted, fontFamily: "Inter, sans-serif", padding: 16, textAlign: "center", paddingTop: 40, fontSize: 13 }}>Artist not found</div>;

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
        {artist.banner_image && (
          <img src={artist.banner_image} alt="Banner" style={{ width: "100%", height: 80, objectFit: "cover" }} />
        )}
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {artist.profile_image ? (
              <img src={artist.profile_image} alt={artist.display_name} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accent}`, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Music style={{ width: 24, height: 24, color: accent }} />
              </div>
            )}
            <div>
              <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: text }}>{artist.display_name}</p>
              {artist.genre && <p style={{ fontSize: 11, color: accent, margin: "2px 0 0", fontFamily: "monospace", textTransform: "uppercase" }}>{artist.genre.replace(/_/g," ")}</p>}
              {artist.location && <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>{artist.location}</p>}
            </div>
          </div>
          {artist.bio && (
            <p style={{ fontSize: 13, color: muted, marginTop: 10, lineHeight: 1.5 }}>{artist.bio.slice(0, 200)}{artist.bio.length > 200 ? "…" : ""}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a href={`${window.location.origin}/artists/${artist.id}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", background: `${accent}22`, borderRadius: 8, color: accent, fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "monospace" }}>
              <ExternalLink style={{ width: 12, height: 12 }} /> View Profile
            </a>
            {artist.approval_status === "approved" && (
              <a href={`${window.location.origin}/book/${artist.id}`} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", background: `${accent}`, borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "monospace" }}>
                Book Artist
              </a>
            )}
          </div>
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