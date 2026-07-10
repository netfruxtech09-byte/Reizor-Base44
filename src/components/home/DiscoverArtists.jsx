import { Link } from "react-router-dom";
import { Music, MapPin, ArrowRight, ChevronRight } from "lucide-react";
import ArtistAvatar from "@/components/artist/ArtistAvatar";
import { formatGenres } from "@/utils/metadataFormat";
import SeeAllButton from "./SeeAllButton";

// ── Section ─────────────────────────────────────────────────────────────────
export default function DiscoverArtists({ artists, loading }) {
  // Filter to active + approved (public) artists only. Exclude suspended,
  // rejected, pending, or deleted accounts. Optional fields don't disqualify.
  const publicArtists = (artists || []).filter(
    (a) => a.status === "active" && a.approval_status === "approved"
  );

  if (loading) {
    return (
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card border border-border/50 p-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-4 w-20 bg-muted rounded mt-3" />
              <div className="h-3 w-24 bg-muted rounded mt-2" />
              <div className="h-8 w-20 bg-muted rounded mt-3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Hide section entirely when no public artists exist — no blank area.
  if (publicArtists.length === 0) return null;

  return (
    <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ DISCOVER</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">ARTISTS</h2>
        </div>
        <SeeAllButton to="/artists" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {publicArtists.map((artist) => {
          const location = artist.location || [artist.city, artist.state, artist.country].filter(Boolean).join(", ");
          const followers = artist.follower_count || 0;
          return (
            <Link
              key={artist.id}
              to={`/artists/${artist.id}`}
              className="bg-card border border-border/50 rounded-xl p-3 hover:border-primary/40 hover:bg-card/80 hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 cursor-pointer group flex flex-col"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 overflow-hidden shrink-0">
                <ArtistAvatar artist={artist} className="w-full h-full border-0" iconClass="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-xs truncate group-hover:text-primary transition-colors">{artist.display_name}</h3>
              {location && (
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 truncate font-mono leading-tight">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />{location}
                </p>
              )}
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/20">
                <span className="font-mono text-[9px] text-muted-foreground">{formatGenres(artist.genre) || `${followers} follower${followers !== 1 ? "s" : ""}`}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}