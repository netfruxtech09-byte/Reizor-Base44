import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Music, Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ShareLinkButton from "@/components/shared/ShareLinkButton";
import PageMeta from "@/components/seo/PageMeta";
import TourShowRow from "@/components/artist/TourShowRow";

/**
 * ArtistTour — public fan-facing Tour Schedule page.
 * Renders tour dates as horizontal accordion rows. Clicking a row expands its
 * details inline (only one open at a time). All data comes from the existing
 * ArtistTourSchedule entity; no video.
 */
export default function ArtistTour() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      base44.entities.Artist.filter({ id }, null, 1).catch(() => []),
      base44.entities.ArtistTourSchedule.filter({ artist_id: id }, "date", 500).catch(() => []),
    ]).then(([artists, tourShows]) => {
      if (cancelled) return;
      setArtist(artists[0] || null);
      setShows(tourShows);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, retryKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl">📡</div>
          <p className="font-display font-bold text-xl">Couldn't load the tour schedule</p>
          <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-border text-sm font-mono font-bold hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <button onClick={() => { setLoading(true); setRetryKey(k => k + 1); }} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-mono font-bold glow-lime">Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = shows.filter(s => new Date(s.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = shows.filter(s => new Date(s.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

  const pageUrl = `${window.location.origin}/artists/${id}/tour`;
  const shareTitle = artist ? `${artist.display_name} — Tour Schedule` : "Artist Tour Schedule";

  const toggle = (showId) => setExpandedId((prev) => (prev === showId ? null : showId));

  return (
    <div className="min-h-screen pb-20">
      {artist && (
        <PageMeta
          title={`${artist.display_name} Tour Schedule — REIZOR`}
          description={`All upcoming and past tour dates for ${artist.display_name} worldwide.`}
          canonical={`https://reizor.com/artists/${id}/tour`}
          ogImage={artist.profile_image || artist.cover_image || ""}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-display font-bold text-base leading-tight truncate">Tour Schedule</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Artist header */}
        {artist && (
          <div className="flex items-center gap-3">
            {artist.profile_image ? (
              <img src={artist.profile_image} alt={artist.display_name} className="w-14 h-14 rounded-full object-cover border-2 border-background shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center shrink-0">
                <Music className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link to={`/artists/${id}`} className="font-display font-black text-xl truncate hover:text-primary transition-colors">
                {artist.display_name}
              </Link>
              <p className="text-xs font-display text-[#a0a0a0]">{artist.genre?.replace(/_/g, " ")}</p>
            </div>
          </div>
        )}

        <ShareLinkButton url={pageUrl} title={shareTitle} text={shareTitle} label="Share Tour Schedule" className="w-full" />

        {/* Shows */}
        {shows.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-display font-bold">No tour dates announced yet</p>
            <p className="text-xs text-muted-foreground mt-1">Check back soon for upcoming shows</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display font-black text-lg tracking-tight">UPCOMING SHOWS</h2>
                {upcoming.map((show) => (
                  <TourShowRow
                    key={show.id}
                    show={show}
                    artistId={id}
                    expanded={expandedId === show.id}
                    onToggle={() => toggle(show.id)}
                  />
                ))}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display font-black text-lg tracking-tight text-muted-foreground">PAST SHOWS</h2>
                {past.map((show) => (
                  <TourShowRow
                    key={show.id}
                    show={show}
                    artistId={id}
                    past
                    expanded={expandedId === show.id}
                    onToggle={() => toggle(show.id)}
                  />
                ))}
              </section>
            )}
          </>
        )}

        {/* Back to artist */}
        <Link to={`/artists/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to {artist?.display_name || "artist"}'s profile
        </Link>
      </div>
    </div>
  );
}