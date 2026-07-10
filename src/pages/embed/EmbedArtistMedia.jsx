import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image, Play } from "lucide-react";

export default function EmbedArtistMedia() {
  const params = new URLSearchParams(window.location.search);
  const { id: artistId } = useParams();
  const theme = params.get("theme") || "dark";
  const [albums, setAlbums] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ArtistAlbum.filter({ artist_id: artistId, approval_status: "approved", is_public: true }, "-created_date", 9).catch(() => []),
      base44.entities.Artist.list(null, 100).then(all => all.filter(a => a.id === artistId)).catch(() => []),
    ]).then(([albs, artists]) => {
      setAlbums(albs);
      setArtist(artists[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [artistId]);

  const isDark = theme !== "light";
  const bg = isDark ? "#0a0d18" : "#ffffff";
  const border = isDark ? "#1e2a3a" : "#e5e7eb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const muted = isDark ? "#94a3b8" : "#6b7280";
  const accent = "#ff1b8d";

  // Flatten media items
  const mediaItems = albums.flatMap(album =>
    (album.media_urls || []).slice(0, 3).map((url, i) => ({
      url,
      type: (album.media_types || [])[i] || "image",
      albumTitle: album.title,
      albumId: album.id,
    }))
  ).slice(0, 9);

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      {artist && (
        <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: text }}>{artist.display_name} — Media</p>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: muted }}>Loading…</div>
      ) : mediaItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Image style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.3, color: muted }} />
          <p style={{ color: muted, fontSize: 14 }}>No media available</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {mediaItems.map((item, i) => (
            <a key={i} href={`${window.location.origin}/artists/${artistId}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: `1px solid ${border}`, position: "relative", textDecoration: "none" }}>
              {item.type === "video" ? (
                <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                    <Play style={{ width: 24, height: 24, color: "#fff" }} />
                  </div>
                </div>
              ) : (
                <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </a>
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