import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { parseVideoUrl, isDirectVideoUrl } from "./EventMediaUploader";
import EventMediaLightbox from "./EventMediaLightbox";

/**
 * Props:
 *   coverImage    string     — main flyer (image or direct MP4). Excluded from gallery to avoid duplication.
 *   galleryImages string[]   — additional gallery images/videos
 *   teaserVideoUrl string    — raw YouTube / Vimeo URL (external embed only)
 */
export default function EventMediaGallery({ coverImage, galleryImages = [], teaserVideoUrl, onBuyNow, buyLabel, showBuy }) {
  // Build gallery list — exclude the cover/flyer so it's not duplicated from the hero spot
  const allImages = (() => {
    const imgs = galleryImages.filter(Boolean).filter(url => url !== coverImage);
    return imgs;
  })();

  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(null); // index or null
  const autoRotateRef = useRef(null);
  const embedUrl = parseVideoUrl(teaserVideoUrl);

  // Auto-rotate every 3 seconds (only when lightbox is closed)
  useEffect(() => {
    if (allImages.length <= 1 || lightbox !== null) return;
    autoRotateRef.current = setInterval(() => {
      setCurrent(i => (i + 1) % allImages.length);
    }, 3000);
    return () => clearInterval(autoRotateRef.current);
  }, [allImages.length, lightbox]);

  const prev = () => {
    setCurrent(i => (i - 1 + allImages.length) % allImages.length);
  };
  const next = () => {
    setCurrent(i => (i + 1) % allImages.length);
  };

  if (allImages.length === 0 && !embedUrl) return null;

  return (
    <div className="space-y-4">
      {/* ── Carousel / single image ── */}
      {allImages.length > 0 && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          {/* Main slide */}
          <div
            className="aspect-[16/9] sm:aspect-[21/9] cursor-pointer"
            onClick={() => setLightbox(current)}
          >
            {isDirectVideoUrl(allImages[current]) ? (
              <video
                src={allImages[current]}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={allImages[current]}
                alt={`Event photo ${current + 1}`}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            )}
          </div>

          {/* Arrows — only if multiple */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-white scale-125" : "bg-white/40"}`}
                  />
                ))}
              </div>

              {/* Counter */}
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                {current + 1} / {allImages.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Thumbnail strip (only when 3+ images) ── */}
      {allImages.length >= 3 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-16 h-11 rounded-md overflow-hidden border-2 transition-all ${i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"}`}
            >
              <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── External video (YouTube / Vimeo only) ── */}
      {embedUrl && !isDirectVideoUrl(teaserVideoUrl) && (
        <div>
          <div className="rounded-xl overflow-hidden aspect-video bg-black relative">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              title="Event video"
              loading="lazy"
              width="100%"
              height="100%"
            />
          </div>
          {teaserVideoUrl && (
            <a
              href={teaserVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
            >
              <Play className="w-3 h-3" /> Watch on YouTube / Vimeo
            </a>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <EventMediaLightbox
          items={allImages}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
          onBuyNow={onBuyNow}
          buyLabel={buyLabel}
          showBuy={showBuy}
        />
      )}
    </div>
  );
}