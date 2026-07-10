import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Music, ExternalLink, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Resolves an artist name → platform Artist record (if exists) and handles click tracking + not-found modal
export default function LineupArtistLink({ artistName, performanceTime, socialLink, eventId, eventTitle }) {
  const [artistRecord, setArtistRecord] = useState(undefined); // undefined=loading, null=not found, obj=found
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!artistName) return;
    base44.entities.Artist.filter({ display_name: artistName }, null, 1)
      .then(res => setArtistRecord(res[0] || null))
      .catch(() => setArtistRecord(null));
  }, [artistName]);

  const trackClick = async (isOnPlatform, artistId) => {
    const user = await base44.auth.me().catch(() => null);
    base44.entities.ArtistClickTracking.create({
      artist_name: artistName,
      artist_id: artistId || "",
      is_on_platform: isOnPlatform,
      event_id: eventId || "",
      event_title: eventTitle || "",
      user_email: user?.email || "",
      source: "lineup_click",
    }).catch(() => {});
  };

  const handleNotOnPlatformClick = () => {
    trackClick(false, "");
    setShowModal(true);
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          {artistRecord?.profile_image && (
            <img src={artistRecord.profile_image} alt="" className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
          )}
          <div className="min-w-0">
            {/* Artist name — always first */}
            {artistRecord === undefined ? (
              <span className="font-display font-bold text-sm block">{artistName}</span>
            ) : artistRecord ? (
              <Link
                to={`/artists/${artistRecord.id}`}
                onClick={() => trackClick(true, artistRecord.id)}
                className="font-display font-bold text-sm hover:text-primary transition-colors flex items-center gap-1.5 group flex-wrap"
              >
                {artistName}
                <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">View Profile</span>
              </Link>
            ) : (
              <button
                onClick={handleNotOnPlatformClick}
                className="font-display font-bold text-sm hover:text-muted-foreground transition-colors flex items-center gap-1.5 group text-left flex-wrap"
              >
                {artistName}
                <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Not on Reizor</span>
              </button>
            )}
            {/* Set Time — directly below artist name */}
            {performanceTime && (
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                <span className="text-muted-foreground/60">Set Time</span>{" "}
                <span className="text-primary font-bold">{performanceTime}</span>
              </p>
            )}
          </div>
        </div>
        {socialLink && (
          <a href={socialLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-accent hover:underline shrink-0 ml-2">
            <ExternalLink className="w-3 h-3" /> Profile
          </a>
        )}
      </div>

      {/* Not-on-platform modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Music className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl tracking-tight">{artistName}</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Doesn't know what they're missing out on — but they'll be with us soon! 🎶
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                We've noted your interest. Stay tuned!
              </p>
            </div>
            <button onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm hover:bg-primary/90 transition-colors">
              Can't Wait! 🔥
            </button>
          </div>
        </div>
      )}
    </>
  );
}