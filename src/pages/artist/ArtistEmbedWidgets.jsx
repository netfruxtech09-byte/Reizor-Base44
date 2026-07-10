import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import EmbedCodePanel from "@/components/shared/EmbedCodePanel";
import { Code2 } from "lucide-react";

const ARTIST_WIDGETS = [
  { key: "profile", label: "Profile Card",   path: "profile" },
  { key: "tour",    label: "Tour Schedule",  path: "tour" },
  { key: "media",   label: "Media Gallery",  path: "media" },
];

export default function ArtistEmbedWidgets() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async u => {
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      setArtist(artists[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!artist) return (
    <div className="text-center py-20 text-muted-foreground text-sm">
      Artist profile required to use embed widgets.
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-primary" />
          <h1 className="font-display font-black text-2xl tracking-tight">Website Widgets</h1>
        </div>
        <p className="text-sm text-muted-foreground">Embed Reizor widgets on your external website to promote your music and tours.</p>
      </div>
      <EmbedCodePanel type="artist" id={artist.id} widgets={ARTIST_WIDGETS} />
    </div>
  );
}