import { useState } from "react";
import { Bell, BellOff, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const GENRES = [
  "techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb",
  "pop", "rock", "jazz", "electronic", "latin", "reggaeton", "afrobeats", "other"
];

const GENRE_LABELS = {
  techno: "Techno", house: "House", drum_and_bass: "Drum & Bass",
  trance: "Trance", hip_hop: "Hip Hop", rnb: "R&B", pop: "Pop",
  rock: "Rock", jazz: "Jazz", electronic: "Electronic", latin: "Latin",
  reggaeton: "Reggaeton", afrobeats: "Afrobeats", other: "Other"
};

export default function NotificationPreferences({ profile, onUpdate }) {
  const [enabled, setEnabled] = useState(
    profile?.booking_notifications_enabled !== false
  );
  const [genres, setGenres] = useState(profile?.preferred_genres || []);
  const [saving, setSaving] = useState(false);

  const toggleGenre = (genre) => {
    setGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      booking_notifications_enabled: enabled,
      preferred_genres: genres,
    };
    if (profile?.id) {
      await base44.entities.OrganizerProfile.update(profile.id, updates);
    }
    onUpdate(updates);
    setSaving(false);
    toast.success("Notification preferences saved");
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 space-y-5">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-display font-bold">Notification Preferences</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Get notified when artists are booked in your region
          </p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary border border-border/50">
        <div className="flex items-start gap-3">
          {enabled ? <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : <BellOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm font-bold">Artist availability notifications</p>
            <p className="text-xs text-muted-foreground font-mono">
              Receive email + in-app alerts when artists are booked near you
            </p>
          </div>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Genre filter */}
      {enabled && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-accent" />
            <p className="text-sm font-bold">Preferred Genres</p>
            <span className="text-xs text-muted-foreground font-mono">(leave empty for all genres)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(genre => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition-all ${
                  genres.includes(genre)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/50"
                }`}
              >
                {GENRE_LABELS[genre]}
              </button>
            ))}
          </div>
          {genres.length > 0 && (
            <button
              onClick={() => setGenres([])}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all → notify for all genres
            </button>
          )}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}