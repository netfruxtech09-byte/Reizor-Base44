import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function VideoCarousel() {
  const [videos, setVideos] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        // Fetch artist posts with video media - only approved ones
        const posts = await base44.entities.ArtistPost.list(null, 200);
        const allVideos = [];
        
        posts.forEach(post => {
          // Skip unapproved media (only filter if approval_status exists; legacy = show)
          if (post.media_approval_status && post.media_approval_status !== "approved") return;
          if (post.media_types && post.media_urls) {
            post.media_types.forEach((type, idx) => {
              if (type === "video" && post.media_urls[idx]) {
                allVideos.push({
                  id: `${post.id}-${idx}`,
                  url: post.media_urls[idx],
                  artist: post.artist_name,
                  title: post.media_titles?.[idx] || post.caption || "Artist Video",
                });
              }
            });
          }
        });

        // Shuffle videos for random display
        const shuffled = allVideos.sort(() => Math.random() - 0.5);
        setVideos(shuffled.length > 0 ? shuffled : []);
      } catch (error) {
        console.error("Failed to fetch carousel videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const [resetKey, setResetKey] = useState(0);

  const goTo = (idx) => {
    setCurrentIdx(idx);
    setResetKey(k => k + 1);
  };

  useEffect(() => {
    if (videos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % videos.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [videos.length, resetKey]);

  if (loading || videos.length === 0) return null;

  const current = videos[currentIdx];

  return (
    <section className="relative h-[280px] sm:h-[600px] overflow-hidden bg-background">
      {/* Video Background */}
      <video
        key={current.id}
        src={current.url}
        autoPlay
        muted
        loop
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/50 to-background" />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-mono text-muted-foreground mb-2 uppercase tracking-wider">
          Featured Artist
        </p>
        <h2 className="font-display font-black text-3xl sm:text-5xl tracking-tight mb-2">
          {current.artist}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {current.title}
        </p>
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={() => goTo((currentIdx - 1 + videos.length) % videos.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/50 hover:bg-background/80 transition-all border border-border/30"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => goTo((currentIdx + 1) % videos.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/50 hover:bg-background/80 transition-all border border-border/30"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {videos.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentIdx
                ? "w-8 bg-primary"
                : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}