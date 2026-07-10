import { useState, useEffect, useCallback } from "react";
import { Music, X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ArtistFeaturedSection({ artistId }) {
  const [albums, setAlbums] = useState([]);
  // lightbox: { albumIndex, mediaIndex } | null
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    base44.entities.ArtistAlbum.filter({ artist_id: artistId, is_public: true, approval_status: "approved" }, "-created_date", 10)
      .then(setAlbums)
      .catch(() => {});
  }, [artistId]);

  // Flatten all media across albums for cross-album navigation
  const allMedia = albums.flatMap((album) =>
    (album.media_urls || []).map((url, i) => ({
      url,
      type: album.media_types?.[i] || "image",
      caption: album.media_captions?.[i] || album.title,
      albumTitle: album.title,
    }))
  );

  const openLightbox = (album, mediaIndex) => {
    // Find the flat index for this media item
    let flatIndex = 0;
    for (const a of albums) {
      if (a.id === album.id) { flatIndex += mediaIndex; break; }
      flatIndex += (a.media_urls?.length || 0);
    }
    setLightbox(flatIndex);
  };

  const openAlbumCover = (album) => {
    // Open the first media item, or just show the cover in a simple lightbox
    if (album.media_urls?.length > 0) {
      openLightbox(album, 0);
    } else if (album.cover_url) {
      // find index in allMedia — cover isn't in media_urls, so we open a cover-only view
      setLightbox({ coverOnly: true, url: album.cover_url, title: album.title });
    }
  };

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const prev = useCallback(() => {
    setLightbox(i => {
      if (typeof i !== "number") return i;
      return (i - 1 + allMedia.length) % allMedia.length;
    });
  }, [allMedia.length]);

  const next = useCallback(() => {
    setLightbox(i => {
      if (typeof i !== "number") return i;
      return (i + 1) % allMedia.length;
    });
  }, [allMedia.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, closeLightbox, prev, next]);

  if (albums.length === 0) return null;

  const currentMedia = typeof lightbox === "number" ? allMedia[lightbox] : null;
  const coverOnlyLightbox = lightbox && typeof lightbox === "object" && lightbox.coverOnly;

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-lg">FEATURED TRACKS & ALBUMS</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {albums.map((album) => (
          <div
            key={album.id}
            onClick={() => openAlbumCover(album)}
            className="rounded-xl bg-card border border-border/50 overflow-hidden group hover:border-primary/30 transition-colors cursor-pointer"
          >
            {album.cover_url ? (
              <div className="relative w-full aspect-square overflow-hidden">
                <img
                  src={album.cover_url}
                  alt={album.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Play / expand overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {album.media_types?.[0] === "video"
                      ? <Play className="w-5 h-5 text-white fill-white" />
                      : <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    }
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Music className="w-8 h-8 text-primary/40" />
              </div>
            )}
            <div className="p-3">
              <p className="font-display font-bold text-sm truncate">{album.title}</p>
              {album.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{album.description}</p>
              )}
              {album.media_urls?.length > 0 && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  {album.media_urls.length} item{album.media_urls.length !== 1 ? "s" : ""} · tap to view
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Lightbox ── */}
      {(currentMedia || coverOnlyLightbox) && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Prev / Next (only for multi-media) */}
          {typeof lightbox === "number" && allMedia.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 sm:left-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 sm:right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Media */}
          <div
            className="max-w-4xl w-full max-h-[80vh] px-14 sm:px-20 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {coverOnlyLightbox ? (
              <img
                src={lightbox.url}
                alt={lightbox.title}
                className="max-h-[75vh] max-w-full rounded-lg object-contain"
              />
            ) : currentMedia?.type === "video" ? (
              <video
                key={lightbox}
                src={currentMedia.url}
                controls
                autoPlay
                className="max-h-[75vh] max-w-full rounded-lg"
              />
            ) : (
              <img
                key={lightbox}
                src={currentMedia.url}
                alt={currentMedia.caption}
                className="max-h-[75vh] max-w-full rounded-lg object-contain"
              />
            )}

            {/* Caption + counter */}
            {currentMedia?.caption && (
              <p className="text-center text-sm text-white/70 font-mono">{currentMedia.caption}</p>
            )}
            {typeof lightbox === "number" && allMedia.length > 1 && (
              <p className="text-center text-xs text-white/40 font-mono">{lightbox + 1} / {allMedia.length}</p>
            )}
          </div>

          {/* Thumbnail strip */}
          {typeof lightbox === "number" && allMedia.length > 1 && (
            <div
              className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {allMedia.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox(i)}
                  className={`relative shrink-0 w-10 h-10 rounded overflow-hidden border-2 transition-all ${
                    i === lightbox ? "border-primary scale-110" : "border-white/20 opacity-60 hover:opacity-100"
                  }`}
                >
                  {m.type === "video" ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Play className="w-3 h-3 text-white fill-white" />
                    </div>
                  ) : (
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}