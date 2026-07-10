import { useState, useEffect } from "react";
import { Mic2, Lightbulb, Music, FileText, Coffee, Info, ExternalLink, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SECTIONS = [
  { key: "sound_requirements", label: "Sound Requirements", icon: Mic2 },
  { key: "lighting_requirements", label: "Lighting Requirements", icon: Lightbulb },
  { key: "stage_notes", label: "Stage Plot & Notes", icon: Music },
  { key: "backline", label: "Backline", icon: FileText },
  { key: "hospitality", label: "Hospitality", icon: Coffee },
  { key: "additional_notes", label: "Additional Notes", icon: Info },
];

export default function TechnicalRiderView({ artistId, artistName }) {
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistId) { setLoading(false); return; }
    base44.entities.TechnicalRider.filter({ artist_id: artistId }, null, 1)
      .then(r => { setRider(r[0] || null); setLoading(false); });
  }, [artistId]);

  if (loading) return <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />;
  if (!rider) return (
    <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground text-center">
      No technical rider uploaded by {artistName || "this artist"} yet.
    </div>
  );
  if (!rider.is_public) return (
    <div className="p-4 rounded-lg bg-muted flex items-center gap-2 text-sm text-muted-foreground">
      <Lock className="w-4 h-4" /> This rider is set to private by the artist.
    </div>
  );

  const hasSections = SECTIONS.some(s => rider[s.key]);

  return (
    <div className="space-y-4">
      {hasSections ? SECTIONS.filter(s => rider[s.key]).map(({ key, label, icon: Icon }) => (
        <div key={key} className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-4 h-4 text-primary" />
            <p className="font-display font-bold text-sm">{label}</p>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rider[key]}</p>
        </div>
      )) : (
        <p className="text-sm text-muted-foreground">No details added yet.</p>
      )}

      <div className="flex gap-3">
        {rider.stage_plot_url && (
          <a href={rider.stage_plot_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline">
            <ExternalLink className="w-3 h-3" /> Stage Plot
          </a>
        )}
        {rider.input_list_url && (
          <a href={rider.input_list_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline">
            <ExternalLink className="w-3 h-3" /> Input List
          </a>
        )}
      </div>
    </div>
  );
}