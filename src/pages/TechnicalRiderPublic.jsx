import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import TechnicalRiderView from "../components/artist/TechnicalRiderView";
import { base44 } from "@/api/base44Client";

export default function TechnicalRiderPublic() {
  const { artistId } = useParams();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Artist.filter({ id: artistId }, null, 1)
      .then(a => { setArtist(a[0] || null); setLoading(false); });
  }, [artistId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!artist) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Artist not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen py-10 px-4 max-w-2xl mx-auto space-y-6">
      <Link to={`/artists/${artist.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {artist.display_name}
      </Link>

      <div className="flex items-center gap-4">
        {artist.profile_image ? (
          <img src={artist.profile_image} alt={artist.display_name} className="w-14 h-14 rounded-full object-cover border-2 border-border" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xl text-primary">
            {artist.display_name[0]}
          </div>
        )}
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight">{artist.display_name}</h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Technical Rider</p>
        </div>
      </div>

      <TechnicalRiderView artistId={artist.id} artistName={artist.display_name} />
    </div>
  );
}