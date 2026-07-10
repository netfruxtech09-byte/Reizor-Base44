import { useState, useEffect } from "react";
import { Save, Upload, Globe, Lock, Copy, Check, FileText, Music, Lightbulb, Mic2, Coffee, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SECTIONS = [
  { key: "sound_requirements", label: "Sound Requirements", icon: Mic2, placeholder: "PA system specs, monitors, DI boxes, microphones needed, FOH requirements..." },
  { key: "lighting_requirements", label: "Lighting Requirements", icon: Lightbulb, placeholder: "Lighting rig, effects, moving heads, strobes, follow spot requirements..." },
  { key: "stage_notes", label: "Stage Plot & Notes", icon: Music, placeholder: "Stage dimensions, instrument placement, power requirements, cable runs..." },
  { key: "backline", label: "Backline Requirements", icon: FileText, placeholder: "Amplifiers, drum kit specs, keyboard stands, any provided or required gear..." },
  { key: "hospitality", label: "Hospitality Rider", icon: Coffee, placeholder: "Catering, beverages, dressing room requirements, parking, accommodation..." },
  { key: "additional_notes", label: "Additional Notes", icon: Info, placeholder: "Any other technical or production requirements..." },
];

export default function ArtistTechnicalRider() {
  const [artist, setArtist] = useState(null);
  const [rider, setRider] = useState(null);
  const [form, setForm] = useState({
    sound_requirements: "", lighting_requirements: "", stage_notes: "",
    backline: "", hospitality: "", additional_notes: "", is_public: false,
    stage_plot_url: "", input_list_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) return;
      setArtist(artists[0]);
      const riders = await base44.entities.TechnicalRider.filter({ artist_id: artists[0].id }, null, 1);
      if (riders[0]) {
        setRider(riders[0]);
        setForm({
          sound_requirements: riders[0].sound_requirements || "",
          lighting_requirements: riders[0].lighting_requirements || "",
          stage_notes: riders[0].stage_notes || "",
          backline: riders[0].backline || "",
          hospitality: riders[0].hospitality || "",
          additional_notes: riders[0].additional_notes || "",
          is_public: riders[0].is_public || false,
          stage_plot_url: riders[0].stage_plot_url || "",
          input_list_url: riders[0].input_list_url || "",
        });
      }
    });
  }, []);

  const handleSave = async () => {
    if (!artist) return;
    setSaving(true);
    const data = { ...form, artist_id: artist.id, artist_name: artist.display_name, artist_email: artist.user_email };
    if (rider) {
      await base44.entities.TechnicalRider.update(rider.id, data);
      setRider(r => ({ ...r, ...data }));
    } else {
      const created = await base44.entities.TechnicalRider.create(data);
      setRider(created);
    }
    toast.success("Technical rider saved!");
    setSaving(false);
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(u => ({ ...u, [field]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, [field]: file_url }));
    setUploading(u => ({ ...u, [field]: false }));
    toast.success("File uploaded!");
  };

  const publicLink = rider ? `${window.location.origin}/rider/${artist?.id}` : null;

  const copyLink = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">TECHNICAL RIDER</h1>
        <p className="text-sm text-muted-foreground mt-1">Define your production requirements for promoters and venues</p>
      </div>

      {/* Public toggle + share link */}
      <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${form.is_public ? "bg-green-400/10" : "bg-muted"}`}>
            {form.is_public ? <Globe className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <p className="font-display font-bold text-sm">{form.is_public ? "Public — anyone with the link can view" : "Private — only you and organizers you've worked with"}</p>
            <p className="text-xs text-muted-foreground font-mono">Toggle to share your rider publicly</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_public ? "bg-green-500" : "bg-muted-foreground/30"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_public ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          {form.is_public && rider && (
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 font-mono text-xs">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          )}
        </div>
      </div>

      {/* Text sections */}
      <div className="space-y-4">
        {SECTIONS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <Label className="font-display font-bold text-sm">{label}</Label>
            </div>
            <textarea
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              rows={3}
              placeholder={placeholder}
              className="w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
            />
          </div>
        ))}
      </div>

      {/* File uploads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { field: "stage_plot_url", label: "Stage Plot", accept: "image/*,.pdf" },
          { field: "input_list_url", label: "Input List", accept: "image/*,.pdf,.xlsx,.csv" },
        ].map(({ field, label, accept }) => (
          <div key={field} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
            <Label className="font-display font-bold text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" /> {label}
            </Label>
            {form[field] ? (
              <div className="flex items-center gap-2">
                <a href={form[field]} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono text-accent hover:underline truncate flex-1">View uploaded file</a>
                <button onClick={() => setForm(f => ({ ...f, [field]: "" }))} className="text-xs text-destructive font-mono hover:underline">Remove</button>
              </div>
            ) : (
              <label className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-accent/40 transition-colors">
                <span className="text-xs text-muted-foreground font-mono">{uploading[field] ? "Uploading..." : "Click to upload"}</span>
                <input type="file" accept={accept} className="hidden" onChange={e => handleFileUpload(e, field)} />
              </label>
            )}
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full glow-lime font-display font-bold gap-2">
        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Rider"}
      </Button>
    </div>
  );
}