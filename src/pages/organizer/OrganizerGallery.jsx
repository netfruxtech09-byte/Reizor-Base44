import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, X, Images, Video, Star, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";

export default function OrganizerGallery() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null); // { post }

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      const all = await base44.entities.OrganizerMediaPost.filter(
        { organizer_id: u.id, status: "active", approval_status: "approved" },
        "-created_date",
        200
      );
      setPosts(all);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">GALLERY</h1>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">Your public media gallery · {posts.length} item{posts.length !== 1 ? "s" : ""}</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
          Upload media through <Link to="/organizer/media" className="text-primary font-bold hover:underline">Media Library</Link>. Approved public media will automatically appear in Gallery.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Images className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-display font-bold text-base text-muted-foreground">No media yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            Upload photos or videos in <Link to="/organizer/media" className="text-primary hover:underline">Media Library</Link> — once approved, they'll show up here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map(post => (
            <button
              key={post.id}
              onClick={() => setLightbox({ post })}
              className="relative rounded-xl bg-card border border-border/50 overflow-hidden group/card aspect-square block cursor-pointer"
            >
              {post.media_type === "video" ? (
                post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt={post.caption || ""} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300" />
                ) : (
                  <MediaVideoPlayer src={post.media_url} className="w-full h-full" controls={false} muted />
                )
              ) : (
                <img src={post.media_url} alt={post.caption || ""} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300" />
              )}
              {post.media_type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity" />
              <div className="absolute top-2 left-2 flex gap-1 pointer-events-none">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                  post.media_type === "video" ? "bg-accent/90 text-white" : "bg-primary/90 text-white"
                }`}>
                  {post.media_type === "video" ? <Video className="w-2.5 h-2.5 inline" /> : <ImageIcon className="w-2.5 h-2.5 inline" />}
                  {" "}{post.media_type}
                </span>
                {post.is_360 && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-accent/90 text-white">360°</span>
                )}
                {post.promote_to_front_page && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-yellow-400 text-black flex items-center gap-0.5">
                    <Star className="w-2 h-2" /> Featured
                  </span>
                )}
              </div>
              {post.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <p className="text-[11px] text-white leading-snug line-clamp-2 text-left">{post.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setLightbox(null)}>
          {!lightbox.post.is_360 && (
            <div className="flex items-center justify-between px-4 shrink-0 bg-black/60 backdrop-blur-sm"
              style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 44px)", paddingBottom: 12 }}>
              <button onClick={() => setLightbox(null)} className="p-2 rounded-full bg-white/20 hover:bg-white/40">
                <X className="w-5 h-5 text-white" />
              </button>
              <p className="text-white/50 text-xs font-mono truncate max-w-[200px]">
                {lightbox.post.caption || "Media Preview"}
              </p>
            </div>
          )}
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {lightbox.post.media_type === "video" ? (
              <MediaVideoPlayer
                src={lightbox.post.mux_playback_url || lightbox.post.media_url}
                poster={lightbox.post.thumbnail_url}
                className="max-h-full max-w-full rounded-lg"
                autoPlay
              />
            ) : (
              <img
                src={lightbox.post.media_url}
                alt={lightbox.post.caption || ""}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            )}
          </div>
          <div className="shrink-0 bg-black/60 backdrop-blur-sm px-4 py-3 text-center"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
            {lightbox.post.caption && (
              <p className="text-sm text-white/80 font-mono">{lightbox.post.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}