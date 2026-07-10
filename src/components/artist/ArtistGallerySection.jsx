import { useState, useEffect, useRef } from "react";
import { Images, X, ChevronLeft, ChevronRight, Play, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Video360Player from "@/components/media/Video360Player";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";

export default function ArtistGallerySection({ artist }) {
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { album, index }
  const [loading, setLoading] = useState(true);
  const autoRotateRef = useRef(null);
  const touchStartX = useRef(null);

  useEffect(() => {
    // Only show approved albums publicly; fallback for legacy albums without approval_status
    base44.entities.ArtistAlbum.filter({ artist_id: artist.id, is_public: true }, "sort_order", 20)
      .then(a => {
        // Only show approved albums publicly
        const visible = a.filter(album => album.approval_status === "approved");
        setAlbums(visible);
        setLoading(false);
      });
  }, [artist.id]);

  // Auto-rotate every 3 seconds (only when lightbox is open), resets on manual nav
  useEffect(() => {
    if (!lightbox || lightbox.album.media_urls.length <= 1) return;
    autoRotateRef.current = setInterval(() => {
      setLightbox(l => l ? ({ ...l, index: (l.index + 1) % l.album.media_urls.length }) : null);
    }, 3000);
    return () => clearInterval(autoRotateRef.current);
  }, [lightbox?.resetKey, lightbox?.album?.id]);

  const openLightbox = (album, index) => setLightbox({ album, index, resetKey: 0 });
  const closeLightbox = () => setLightbox(null);
  const prevItem = () => setLightbox(l => ({ ...l, index: (l.index - 1 + l.album.media_urls.length) % l.album.media_urls.length, resetKey: (l.resetKey || 0) + 1 }));
  const nextItem = () => setLightbox(l => ({ ...l, index: (l.index + 1) % l.album.media_urls.length, resetKey: (l.resetKey || 0) + 1 }));

  useEffect(() => {
    const handler = (e) => {
      if (!lightbox) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevItem();
      if (e.key === "ArrowRight") nextItem();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? nextItem() : prevItem();
    touchStartX.current = null;
  };

  if (loading || albums.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-lg">GALLERY</h2>

      {/* Album selector */}
      {albums.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelectedAlbum(null)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold whitespace-nowrap transition-all flex-shrink-0 ${!selectedAlbum ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}>
            All
          </button>
          {albums.map(album => (
            <button key={album.id} onClick={() => setSelectedAlbum(album.id === selectedAlbum ? null : album.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedAlbum === album.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}>
              {album.title} <span className="opacity-60 ml-1">({album.media_urls?.length || 0})</span>
            </button>
          ))}
        </div>
      )}

      {/* Albums grid */}
      {albums.filter(a => !selectedAlbum || a.id === selectedAlbum).map(album => (
        <div key={album.id} className="space-y-2">
          {albums.length > 1 && !selectedAlbum && (
            <div className="flex items-center gap-2">
              <p className="font-display font-bold text-sm">{album.title}</p>
              {album.description && <p className="text-xs text-muted-foreground">— {album.description}</p>}
            </div>
          )}
          {(() => {
            // Build display items: prefer media_urls, fall back to cover_url as a single image
            const mediaUrls = album.media_urls?.length > 0
              ? album.media_urls
              : album.cover_url ? [album.cover_url] : [];
            const mediaTypes = album.media_urls?.length > 0
              ? (album.media_types || [])
              : ["image"];
            const captions = album.media_urls?.length > 0
              ? (album.media_captions || [])
              : [album.title];

            const mediaThumbnails = album.media_urls?.length > 0
              ? (album.media_thumbnails || [])
              : [];
            // Build a synthetic album object for lightbox navigation
            const displayAlbum = { ...album, media_urls: mediaUrls, media_types: mediaTypes, media_captions: captions, media_thumbnails: mediaThumbnails };

            if (mediaUrls.length === 0) return null;
            const albumPlayable = album.is_playable !== false;
            return (
              <div className="grid grid-cols-3 gap-1.5">
                {mediaUrls.map((url, i) => {
                  const isVideo = mediaTypes[i] === "video" || mediaTypes[i] === "video360";
                          const is360 = mediaTypes[i] === "video360" || album.media_is360?.[i] === true;
                          const videoBlocked = isVideo && !albumPlayable;
                          return (
                            <button key={i} onClick={() => videoBlocked ? null : openLightbox(displayAlbum, i)}
                              className={`relative aspect-square rounded-lg overflow-hidden group bg-muted ${videoBlocked ? "cursor-not-allowed opacity-50" : ""}`}>
                              {videoBlocked ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                                  <AlertTriangle className="w-4 h-4 text-muted-foreground/50" />
                                  <span className="text-[8px] font-mono text-muted-foreground/60">Unavailable</span>
                                </div>
                              ) : isVideo ? (
                                <>
                                  {mediaThumbnails[i]
                                    ? <img src={mediaThumbnails[i]} alt="" className="w-full h-full object-cover" />
                                    : <video src={url} className="w-full h-full object-cover" muted />
                                  }
                                  {is360 && (
                                    <div className="absolute top-1 left-1 font-mono text-[8px] font-black bg-black/70 text-white px-1 py-0.5 rounded-full">360°</div>
                                  )}
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-8 h-8 text-white fill-white" />
                                  </div>
                                  <div className="absolute bottom-1 right-1 p-1 rounded bg-black/50">
                                    <Play className="w-2.5 h-2.5 text-white fill-white" />
                                  </div>
                                </>
                              ) : (
                        <>
                          <img src={url} alt={captions[i] || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar — padded for iOS notch/Dynamic Island using a strong fixed offset */}
          <div
            className="flex items-center justify-between px-4 shrink-0 bg-black/60 backdrop-blur-sm"
            style={{
              paddingTop: "max(env(safe-area-inset-top, 0px), 44px)",
              paddingBottom: 12,
            }}
          >
            <div className="flex items-center gap-3">
              <button onClick={closeLightbox} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
              <p className="text-white/70 text-xs font-mono">{lightbox.index + 1} / {lightbox.album.media_urls.length}</p>
            </div>
            <p className="text-white/50 text-xs font-mono truncate max-w-[160px]">{lightbox.album.title}</p>
          </div>

          {/* Media area */}
          <div className="flex-1 flex items-center justify-center relative min-h-0">
            {(() => {
              const mediaType = lightbox.album.media_types?.[lightbox.index];
              const mediaUrl = lightbox.album.media_urls[lightbox.index];
              const is360 = mediaType === "video360" || lightbox.album.media_is360?.[lightbox.index] === true;
              const isPlayable = lightbox.album.is_playable !== false;

              if (mediaType === "video360" || (mediaType === "video" && is360)) {
                if (!isPlayable) {
                  return (
                    <div className="flex flex-col items-center gap-3 text-center px-6">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                      <p className="text-white/70 text-sm font-mono">This video is currently unavailable due to streaming limits.</p>
                    </div>
                  );
                }
                return <div className="w-full max-w-2xl px-4"><Video360Player src={mediaUrl} /></div>;
              }
              if (mediaType === "video") {
                if (!isPlayable) {
                  return (
                    <div className="flex flex-col items-center gap-3 text-center px-6">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                      <p className="text-white/70 text-sm font-mono">This video is currently unavailable due to streaming limits.</p>
                    </div>
                  );
                }
                return (
                  <MediaVideoPlayer
                    key={mediaUrl}
                    src={mediaUrl}
                    poster={lightbox.album.media_thumbnails?.[lightbox.index]}
                    trackingVideoId={lightbox.album.id}
                    trackingVideoType="normal"
                    trackingOwnerType="artist"
                    controls
                    autoPlay
                    className="max-h-full max-w-full"
                  />
                );
              }
              return null;
            })()}
            {lightbox.album.media_types?.[lightbox.index] !== "video" && lightbox.album.media_types?.[lightbox.index] !== "video360" && (
              <img
                src={lightbox.album.media_urls[lightbox.index]}
                alt={lightbox.album.media_captions?.[lightbox.index] || ""}
                className="max-h-full max-w-full object-contain"
              />
            )}

            {/* Nav arrows — always visible when multiple items */}
            {lightbox.album.media_urls.length > 1 && (
              <>
                <button
                  onClick={prevItem}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 border border-white/20 hover:bg-black/90 flex items-center justify-center transition-all shadow-lg"
                >
                  <ChevronLeft className="w-7 h-7 text-white" />
                </button>
                <button
                  onClick={nextItem}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 border border-white/20 hover:bg-black/90 flex items-center justify-center transition-all shadow-lg"
                >
                  <ChevronRight className="w-7 h-7 text-white" />
                </button>
              </>
            )}
          </div>

          {/* Caption + dot indicators */}
          <div className="shrink-0 bg-black/60 backdrop-blur-sm px-4 space-y-2" style={{ paddingTop: 12, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
            {lightbox.album.media_captions?.[lightbox.index] && (
              <p className="text-center text-sm text-white/80 font-mono">
                {lightbox.album.media_captions[lightbox.index]}
              </p>
            )}
            {lightbox.album.media_urls.length > 1 && (
              <div className="flex justify-center gap-1.5">
                {lightbox.album.media_urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightbox(l => ({ ...l, index: i }))}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === lightbox.index ? "bg-white scale-125" : "bg-white/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}