import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Music, Search, Plus, Copy, Check, X } from "lucide-react";

// Resolve the best available profile image URL for an artist (same fallbacks as ArtistAvatar)
function resolveArtistImage(artist) {
  return artist?.profile_image || artist?.avatar || artist?.image || artist?.profile_picture_url || artist?.cover_image || artist?.banner_image || null;
}
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { formatGenres } from "@/utils/metadataFormat";
import BackButton from "@/components/shared/BackButton";
import ArtistShareButton from "@/components/artist/ArtistShareButton";
import ArtistAvatar from "@/components/artist/ArtistAvatar";
import PageMeta from "@/components/seo/PageMeta";
const GENRES = ["techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb", "pop", "rock", "jazz", "electronic", "latin", "reggaeton", "afrobeats", "other"];

export default function Artists() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [myArtist, setMyArtist] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, "-follower_count", 100),
      base44.auth.me().catch(() => null),
    ]).then(async ([a, u]) => {
      setUser(u);
      if (u) {
        const mine = await base44.entities.Artist.filter({ user_email: u.email }, null, 1);
        if (mine[0]) setMyArtist(mine[0]);
      }
      setArtists(a);
      setLoading(false);
    });
  }, []);

  const filtered = artists.filter(a => {
    const matchesQuery = !query || a.display_name?.toLowerCase().includes(query.toLowerCase()) || a.genre?.toLowerCase().includes(query.toLowerCase());
    const matchesGenre = !selectedGenre || (a.genre || "").toLowerCase().split(",").map(s => s.trim()).includes(selectedGenre);
    return matchesQuery && matchesGenre;
  });

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Artists — REIZOR"
        description="Discover independent music artists on Reizor. Follow artists, book them for events, and explore their profiles, music, and tour dates."
        canonical="https://reizor.com/artists"
      />
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <BackButton />
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display font-black text-4xl tracking-tight">ARTISTS</h1>
            <p className="text-sm text-muted-foreground mt-1">Discover independent artists on REIZOR</p>
          </div>
          <div className="flex gap-2">
            {myArtist ? (
              <Button asChild variant="outline" className="font-display font-bold gap-2">
                <Link to="/artist"><Music className="w-4 h-4" /> My Studio</Link>
              </Button>
            ) : user ? (
              <Button asChild className="glow-lime font-display font-bold gap-2">
                <Link to="/artist/signup"><Plus className="w-4 h-4" /> Join as Artist</Link>
              </Button>
            ) : (
              <Button
                className="glow-lime font-display font-bold gap-2"
                onClick={() => {
                  localStorage.setItem("artist_signup_intent", "true");
                  base44.auth.redirectToLogin("/artist/signup");
                }}
              >
                <Plus className="w-4 h-4" /> Join as Artist
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, genres..." className="pl-9 bg-card border-border/50" />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          <button
            onClick={() => setSelectedGenre("")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
              !selectedGenre ? "bg-primary text-white border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            All
          </button>
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(prev => prev === g ? "" : g)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
                selectedGenre === g ? "bg-primary text-white border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {g.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No artists found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((artist) => (
              <Link key={artist.id} to={`/artists/${artist.id}`}
                className="group rounded-xl bg-card border border-border/50 overflow-hidden hover:border-primary/40 transition-colors">
                <div className="relative h-32 bg-gradient-to-br from-primary/20 to-accent/10">
                  {artist.cover_image && <img src={artist.cover_image} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute bottom-0 left-0 p-3 flex items-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const img = resolveArtistImage(artist);
                        if (img) setPreviewImage(img);
                      }}
                      className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={artist.display_name ? `Preview ${artist.display_name} profile image` : "Preview profile image"}
                    >
                      <ArtistAvatar artist={artist} className="w-14 h-14 border-2 border-background" iconClass="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-4 pt-2">
                  <p className="font-display font-black text-lg group-hover:text-primary transition-colors">{artist.display_name}</p>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{formatGenres(artist.genre)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {artist.follower_count || 0} {artist.follower_count === 1 ? "follower" : "followers"}{artist.location ? ` · ${artist.location}` : ""}
                  </p>
                  <div className="mt-2" onClick={e => e.preventDefault()}>
                    <ArtistShareButton artist={artist} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen profile image preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="Artist profile"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}