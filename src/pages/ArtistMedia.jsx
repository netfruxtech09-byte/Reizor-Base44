import { useState, useEffect, useMemo } from "react";
import { Play, Music, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageMeta from "@/components/seo/PageMeta";
import BackButton from "@/components/shared/BackButton";
import SpotlightMediaModal from "@/components/home/SpotlightMediaModal";

/**
 * ArtistMedia — public "Artist Spotlight" media gallery.
 * Shows all approved artist posts + albums (photos & videos) in a grid.
 * This is the dedicated media destination for the Artist Spotlight See All button.
 */
export default function ArtistMedia() {
  const [posts, setPosts] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ArtistPost.filter({ approval_status: "approved" }, "-created_date", 200).catch(() => []),
      base44.entities.ArtistAlbum.filter({ is_public: true, approval_status: "approved" }, "-created_date", 200).catch(() => []),
      base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, null, 500).catch(() => []),
    ]).then(([p, a, art]) => {
      setPosts(p || []);
      setAlbums(a || []);
      setArtists(art || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const validArtistIds = useMemo(() => new Set(artists.map(a => a.id)), [artists]);

  const media = useMemo(() => {
    const items = [];
    for (const album of albums) {
      if (!album.artist_id || !validArtistIds.has(album.artist_id)) continue;
      (album.media_urls || []).forEach((url, i) => {
        if (!url) return;
        const type = (album.media_types?.[i] || "").toLowerCase();
        items.push({
          id: `album-${album.id}-${i}`, url,
          type: type.includes("video") ? "video" : "image",
          is360: type === "video360" || album.media_is360?.[i] === true,
          thumbnail: album.media_thumbnails?.[i] || "",
          title: album.media_titles?.[i] || album.title || "",
          caption: album.media_captions?.[i] || "",
          artist: album.artist_name || "", artistId: album.artist_id,
          mux_playback_id: null, mux_status: null,
          mobile_playback_url: null, desktop_optimized_url: null,
        });
      });
    }
    for (const post of posts) {
      if (!post.artist_id || !validArtistIds.has(post.artist_id)) continue;
      (post.media_urls || []).forEach((url, i) => {
        if (!url) return;
        const type = (post.media_types?.[i] || "").toLowerCase();
        const mediaType = type.includes("video") ? "video" : "image";
        items.push({
          id: `post-${post.id}-${i}`, url,
          type: mediaType,
          is360: mediaType === "video" && (type === "video360" || post.media_is360?.[i] === true),
          thumbnail: post.media_thumbnails?.[i] || "",
          title: post.media_titles?.[i] || post.caption || "",
          caption: post.caption || "",
          artist: post.artist_name || "", artistId: post.artist_id,
          mux_playback_id: mediaType === "video" ? (post.mux_playback_id || null) : null,
          mux_status: post.mux_status || null,
          desktop_optimized_url: post.desktop_optimized_url || null,
          mobile_playback_url: post.mobile_playback_url || null,
        });
      });
    }
    return items;
  }, [posts, albums, validArtistIds]);

  return (
    <div className="min-h-screen pb-20">
      <PageMeta
        title="Artist Media — REIZOR"
        description="Browse photos and videos from independent artists on Reizor."
        canonical="https://reizor.com/artist-media"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <BackButton />
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ MEDIA</span>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-1">ARTIST SPOTLIGHT</h1>
        <p className="text-sm text-muted-foreground mt-1">Photos and videos from independent artists</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No artist media yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {media.map((item) => (
              <button key={item.id} onClick={() => setActive(item)}
                className="group relative overflow-hidden rounded-xl border border-border/50 hover:border-primary/40 transition-colors">
                <div className="relative aspect-square bg-muted">
                  {item.type === "video" ? (
                    item.thumbnail
                      ? <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-black flex items-center justify-center"><Play className="w-8 h-8 text-white/40" /></div>
                  ) : (
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
                    {item.artist && <p className="text-[9px] font-mono text-primary uppercase tracking-wider truncate">{item.artist}</p>}
                    {item.title && <p className="text-xs font-bold text-white truncate">{item.title}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <SpotlightMediaModal item={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}