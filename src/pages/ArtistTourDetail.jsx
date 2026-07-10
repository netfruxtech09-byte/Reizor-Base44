import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Music, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import TourShowDetails from "@/components/artist/TourShowDetails";
import TourShareButton from "@/components/artist/TourShareButton";

export default function ArtistTourDetail() {
  const { id, showId } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ArtistTourSchedule.filter({ id: showId }, null, 1),
      base44.entities.Artist.filter({ id }, null, 1),
    ]).then(([shows, artists]) => {
      setShow(shows[0] || null);
      setArtist(artists[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, showId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!show || !artist) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-muted-foreground">Tour date not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-sm hover:underline">← Go back</button>
      </div>
    </div>
  );

  const dateObj = show.date ? new Date(show.date) : null;
  const isPast = dateObj && dateObj < new Date();

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-display font-bold text-base leading-tight truncate">Tour Date</h1>
          <TourShareButton show={show} artistId={id} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero image with overlay */}
        {show.promo_image && (
          <div className="relative aspect-video sm:aspect-[21/9] rounded-xl overflow-hidden">
            <img src={show.promo_image} alt={show.venue_name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4 sm:p-6 space-y-1">
              {dateObj && (
                <p className="text-xs font-display text-[#ff007f] font-bold uppercase tracking-widest">
                  {format(dateObj, "EEE, MMM dd yyyy")}
                </p>
              )}
              <h2 className="font-display font-black text-2xl sm:text-3xl leading-tight">{show.venue_name}</h2>
              {show.lineup && <p className="text-sm text-foreground/80">{show.lineup}</p>}
            </div>
          </div>
        )}

        {isPast && (
          <div className="inline-block px-3 py-1 rounded-full bg-muted text-xs font-mono text-muted-foreground font-bold uppercase tracking-widest">
            Past Show
          </div>
        )}

        {/* Artist header */}
        <Link to={`/artists/${id}`} className="flex items-center gap-3 group">
          {artist.profile_image ? (
            <img src={artist.profile_image} alt={artist.display_name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-bold group-hover:text-primary transition-colors">{artist.display_name}</p>
            <p className="text-xs font-display text-[#a0a0a0]">{artist.genre?.replace(/_/g, " ")}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-[#ff007f] ml-auto group-hover:text-[#ff007f]/70 transition-colors" />
        </Link>

        {/* Content card */}
        <TourShowDetails show={show} artistId={id} variant="page" showBanner={false} />

        {/* Back to artist */}
        <Link to={`/artists/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to {artist.display_name}'s profile
        </Link>
      </div>
    </div>
  );
}