import { useState, useEffect, useRef, useMemo } from "react";
import { Play, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { Link } from "react-router-dom";
import Video360Player from "@/components/media/Video360Player";
import VideoThumbnail from "@/components/media/VideoThumbnail";
import useInView from "@/hooks/useInView";
import { useVideoPlaybackControl } from "@/hooks/useVideoPlaybackControl";
import SeeAllButton from "./SeeAllButton";

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export default function FeaturedArtistVideos({ posts: propPosts, artists: propArtists, loading: propLoading }) {
  const posts = propPosts || null;
  const artists = propArtists || null;
  const loading = propLoading ?? false;
  const fetched = !propLoading && propPosts !== undefined;
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeVideoMuted, setActiveVideoMuted] = useState(false);
  const activeVideoRef = useRef(null);

  const [containerRef] = useInView();

  useVideoPlaybackControl(!!activeVideo);

  useEffect(() => {
    if (activeVideo) {
      document.body.classList.add("video-playing");
    } else {
      // Stop the active video explicitly when closing modal
      if (activeVideoRef.current) {
        activeVideoRef.current.pause();
        activeVideoRef.current.currentTime = 0;
      }
      document.body.classList.remove("video-playing");
    }
    return () => document.body.classList.remove("video-playing");
  }, [activeVideo]);

  const validArtistIds = new Set((artists || []).map((a) => a.id));
  const videos = useMemo(() => {
    const expanded = [];
    for (const post of (posts || [])) {
      if (post.approval_status !== "approved") continue;
      if (!post.artist_id || !validArtistIds.has(post.artist_id)) continue;
      if (!post.media_urls?.length) continue;
      post.media_urls.forEach((url, i) => {
        const type = post.media_types?.[i] || "";
        if (type === "video" || type === "video360" || type.includes("video")) {
          expanded.push({
            id: `${post.id}-${i}`, url,
            is360: type === "video360" || post.media_is360?.[i] === true,
            artist_name: post.artist_name,
            caption: post.media_titles?.[i] || post.caption || "",
            thumbnail: post.media_thumbnails?.[i] || "",
            mux_playback_id: post.mux_playback_id || null,
            mux_status: post.mux_status || null,
            desktop_optimized_url: post.desktop_optimized_url || null,
            mobile_playback_url: post.mobile_playback_url || null,
            post,
          });
        }
      });
      if (expanded.length >= 12) break;
    }
    return expanded;
  }, [posts, artists, validArtistIds]);

  if (loading || !fetched) {
    return (
      <section ref={containerRef} className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card border border-border/50 animate-pulse overflow-hidden">
              <div className="aspect-video bg-muted" />
              <div className="p-3">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded mt-1" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (videos.length === 0) return null;

  return (
    <section ref={containerRef} className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ FEATURED</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">ARTIST VIDEOS</h2>
        </div>
        <SeeAllButton to="/artist-media" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {videos.map((item) => (
          <VideoThumbnail key={item.id} src={item.url} is360={item.is360} title={item.artist_name}
            className="border border-border/50 hover:border-primary/40 transition-all"           onPlay={() => { setActiveVideo(item); setActiveVideoMuted(false); }} />
        ))}
      </div>

      {activeVideo && (
      <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden" style={{ width: "100vw", height: "100vh" }}>
      {/* Close button */}
      <button
       onClick={() => setActiveVideo(null)}
       className="absolute top-4 right-4 z-[52] w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
       aria-label="Close video"
      >
       <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
      <div className="absolute left-4 z-[52] pointer-events-none" style={{ top: IS_IOS ? "max(env(safe-area-inset-top, 0px), 56px)" : 16 }}>
       <p className="font-bold text-white text-sm">{activeVideo.artist_name}</p>
       {activeVideo.caption && <p className="text-xs text-white/60 mt-1">{activeVideo.caption}</p>}
      </div>
          {activeVideo.is360 ? (
            <div className="flex-1"><Video360Player src={activeVideo.url} poster={activeVideo.thumbnail} playbackId={activeVideo.mux_playback_id} muxStatus={activeVideo.mux_status} mobileSrc={activeVideo.mobile_playback_url} desktopSrc={activeVideo.desktop_optimized_url} isFullscreen={true} autoPlay onClose={() => setActiveVideo(null)} trackingVideoId={activeVideo.id} trackingOwnerType="artist" /></div>
          ) : (
           <div className="flex-1 relative">
             <video
               ref={activeVideoRef}
               src={activeVideo.url}
               className="w-full h-full object-contain"
               controls
               playsInline
               muted={activeVideoMuted}
               autoPlay
               onPlay={(e) => {
                 // If browser auto-muted to allow autoplay, reflect that in state
                 if (e.target.muted && !activeVideoMuted) setActiveVideoMuted(true);
               }}
               onEnded={() => {
                 // Stop and close when video ends
                 setActiveVideo(null);
               }}
             />
              {/* Mute toggle overlay */}
              <button
                onClick={() => {
                  const v = activeVideoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setActiveVideoMuted(v.muted);
                }}
                className="absolute bottom-14 left-3 z-20 w-9 h-9 rounded-lg bg-black/60 flex items-center justify-center border border-white/20"
                aria-label={activeVideoMuted ? "Unmute" : "Mute"}
              >
                {activeVideoMuted
                  ? <VolumeX className="w-4 h-4 text-white/80" />
                  : <Volume2 className="w-4 h-4 text-white/80" />}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}