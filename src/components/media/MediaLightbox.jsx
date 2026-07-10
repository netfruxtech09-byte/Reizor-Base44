import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Image as ImageIcon } from "lucide-react";
import { isToday, isYesterday, differenceInCalendarDays, format } from "date-fns";
import Video360Player from "@/components/media/Video360Player";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import PostInteractionBar from "@/components/media/PostInteractionBar";
import PostInteractionsSheet from "@/components/media/PostInteractionsSheet";
import { useVideoPlaybackControl } from "@/hooks/useVideoPlaybackControl";

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function formatPostedDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (isToday(d)) return "Posted today";
  if (isYesterday(d)) return "Posted yesterday";
  const daysAgo = differenceInCalendarDays(new Date(), d);
  if (daysAgo > 0 && daysAgo <= 6) return `Posted ${daysAgo} days ago`;
  return `Posted ${format(d, "MMM d, yyyy")}`;
}

/**
 * MediaLightbox — shared full-screen modal for a single media item.
 * Handles 360° video, standard video, and image with interaction bar + comments/reviews sheet.
 * Used by both the home page MediaGallery section and the /gallery "See All" page.
 */
export default function MediaLightbox({ item, currentUser, onClose, videoElRef: externalVideoRef }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [interactionsPost, setInteractionsPost] = useState(null);
  const [barReloadKey, setBarReloadKey] = useState(0);
  const scrollYRef = useRef(0);
  const internalVideoRef = useRef(null);
  const videoElRef = externalVideoRef || internalVideoRef;

  useVideoPlaybackControl(!!item);

  // Reset image loading/error states when a new item opens
  useEffect(() => {
    if (item) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [item]);

  // Lock body scroll for non-360-video modals; restore on close
  useEffect(() => {
    const isNonVideoModal = item && !(item.type === "video" && item.is_360);
    if (!isNonVideoModal) return;

    scrollYRef.current = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [item]);

  if (!item) return null;

  const is360Video = item.type === "video" && item.is_360;
  const isStdVideo = item.type === "video" && !item.is_360;
  const isImage = item.type !== "video";

  return createPortal(
    <>
      {/* 360 video: centered modal */}
      {is360Video && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
          <div className="w-full max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <Video360Player
              src={item.url}
              mobileSrc={item.mobile_playback_url}
              desktopSrc={item.desktop_optimized_url}
              poster={item.thumbnail_url}
              playbackId={item.mux_playback_id}
              muxStatus={item.mux_status}
              onClose={onClose}
              trackingVideoId={item.id}
              trackingOwnerType="organizer"
            />
          </div>
        </div>
      )}

      {/* Standard video: true fullscreen player, scroll locked */}
      {isStdVideo && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ height: "100dvh", width: "100vw" }}>
          <button
            onClick={onClose}
            className="absolute z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/70 border border-white/30"
            style={{ top: IS_IOS ? "max(env(safe-area-inset-top, 16px), 16px)" : 16, right: 16 }}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {item.title && (
            <div
              className="absolute z-10 left-4 right-16 pointer-events-none"
              style={{ top: IS_IOS ? "max(env(safe-area-inset-top, 16px), 16px)" : 16 }}
            >
              {item.organizer_name && (
                <p className="text-[10px] font-mono text-primary uppercase tracking-wider drop-shadow">{item.organizer_name}</p>
              )}
              <p className="font-bold text-white text-sm drop-shadow">{item.title}</p>
              {item.description && <p className="text-xs text-white/60 mt-0.5 drop-shadow">{item.description}</p>}
              {item.created_date && <p className="text-[10px] text-white/50 mt-0.5 drop-shadow">{formatPostedDate(item.created_date)}</p>}
            </div>
          )}

          <div className="flex-1 flex items-center justify-center min-h-0">
            <MediaVideoPlayer
              src={item.url}
              poster={item.thumbnail_url}
              className="w-full h-full"
              style={{ maxHeight: "100dvh" }}
              autoPlay
              muted={false}
              controls
              videoElRef={videoElRef}
              trackingVideoId={item.id}
              trackingOwnerType="organizer"
            />
          </div>
        </div>
      )}

      {/* Image: centered lightbox with loading / error / fallback states */}
      {isImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 overflow-y-auto p-4" onClick={onClose}>
          <div className="min-h-full flex items-center justify-center">
            <div className="max-w-2xl w-full relative my-auto" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 border border-white/30 hover:bg-black/80 transition-all"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="relative min-h-[200px] flex items-center justify-center">
                {!item.url || imageError ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">{imageError ? "This media could not be loaded." : "This media is no longer available."}</p>
                    {imageError && (
                      <button
                        onClick={() => { setImageError(false); setImageLoaded(false); }}
                        className="text-xs font-mono font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center min-h-[40vh]">
                        <div className="w-8 h-8 border-4 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                    <img
                      src={item.url}
                      alt={item.title || "Media"}
                      className={`w-full rounded-lg object-contain max-h-[70vh] transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => { setImageError(true); setImageLoaded(false); }}
                    />
                  </>
                )}
              </div>

              <div className="mt-3">
                <p className="font-bold text-base text-white">{item.title || "Untitled"}</p>
                {item.description && <p className="text-sm text-white/60 mt-1">{item.description}</p>}
                {item.organizer_name && <p className="text-[10px] font-mono text-primary uppercase tracking-wider mt-1">{item.organizer_name}</p>}
              </div>
              {item.organizer_id && (
                <div className="mt-2">
                  <PostInteractionBar
                    key={`${item.id}-${barReloadKey}`}
                    post={item}
                    currentUser={currentUser}
                    onOpenSheet={() => setInteractionsPost(item)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PostInteractionsSheet
        post={interactionsPost}
        currentUser={currentUser}
        isOwner={currentUser?.id === interactionsPost?.organizer_id}
        open={!!interactionsPost}
        onClose={() => { setInteractionsPost(null); setBarReloadKey((k) => k + 1); }}
      />
    </>,
    document.body
  );
}