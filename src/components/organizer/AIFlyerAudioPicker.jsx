import { useState, useRef } from "react";
import { Music, Upload, X, Play, Pause, Volume2, VolumeX, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadToSpaces, recordStorageUsage } from "@/utils/spacesStorage";
import { toast } from "sonner";

const ACCEPTED_AUDIO = ".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/x-m4a";
const MAX_AUDIO_MB = 20;

const PRESET_MUSIC = [
  { value: "auto_music", label: "Auto Music", description: "AI chooses best fit" },
  { value: "edm_house", label: "EDM / House", description: "Energetic club beats" },
  { value: "hip_hop", label: "Hip Hop / Rap", description: "Urban trap & rap beats" },
  { value: "latin", label: "Latin / Reggaeton", description: "Latin dance vibes" },
  { value: "rock", label: "Rock", description: "High energy guitars" },
  { value: "calm", label: "Calm / Cinematic", description: "Atmospheric & moody" },
  { value: "no_music", label: "No Music", description: "Silent / no background audio" },
];

export default function AIFlyerAudioPicker({ value, onChange, organizerId, eventId }) {
  // value shape: { mode: "preset"|"upload"|"none", presetValue: string, uploadedUrl: string, fileName: string }
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const mode = value?.mode || "preset";
  const presetValue = value?.presetValue || "auto_music";
  const uploadedUrl = value?.uploadedUrl || null;
  const fileName = value?.fileName || null;

  const handlePresetSelect = (preset) => {
    if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
    onChange({ mode: "preset", presetValue: preset });
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_AUDIO_MB) {
      toast.error(`Audio file must be under ${MAX_AUDIO_MB}MB.`);
      e.target.value = "";
      return;
    }

    const allowed = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/mp3"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac)$/i)) {
      toast.error("Please upload an MP3, WAV, M4A, or AAC file.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }

    try {
      const folder = organizerId ? `audio/${organizerId}` : "audio/general";
      const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
      recordStorageUsage({
        file_url,
        file_size_bytes,
        mime_type: file.type || "audio/mpeg",
        file_category: "other",
        entity_type: "event",
        entity_id: eventId || "",
      }).catch(() => {});

      onChange({ mode: "upload", uploadedUrl: file_url, fileName: file.name, presetValue: null });
      toast.success("Audio uploaded successfully.");
    } catch (err) {
      toast.error("Audio upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveUpload = () => {
    if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
    onChange({ mode: "preset", presetValue: "auto_music" });
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const selectedPreset = PRESET_MUSIC.find(p => p.value === presetValue);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5" /> Background Music / Audio
          <span className="text-[10px] opacity-60 normal-case">(optional)</span>
        </label>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 border border-border/40">
        {[
          { id: "preset", label: "Preset" },
          { id: "upload", label: "Upload Audio" },
          { id: "none", label: "No Sound" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === "none") {
                if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
                onChange({ mode: "none", presetValue: "no_music" });
              } else if (tab.id === "preset") {
                if (audioRef.current) { audioRef.current.pause(); setPlaying(false); }
                onChange({ mode: "preset", presetValue: presetValue === "no_music" ? "auto_music" : presetValue });
              } else {
                // upload tab — just switch mode, keep existing upload if any
                onChange({ ...value, mode: "upload" });
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-mono font-bold transition-all ${
              mode === tab.id
                ? "bg-accent text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preset selector */}
      {mode === "preset" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {PRESET_MUSIC.filter(p => p.value !== "no_music").map(preset => (
            <button
              key={preset.value}
              onClick={() => handlePresetSelect(preset.value)}
              className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all ${
                presetValue === preset.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border/40 bg-card/60 text-muted-foreground hover:border-accent/40"
              }`}
            >
              <span className="text-xs font-bold leading-tight">{preset.label}</span>
              <span className="text-[10px] font-mono opacity-70 mt-0.5 leading-snug">{preset.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Upload mode */}
      {mode === "upload" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_AUDIO}
            className="hidden"
            onChange={handleFileChange}
          />

          {uploadedUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 hover:bg-accent/30 transition-colors"
              >
                {playing ? <Pause className="w-3.5 h-3.5 text-accent" /> : <Play className="w-3.5 h-3.5 text-accent" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{fileName || "Custom audio"}</p>
                <p className="text-[10px] font-mono text-muted-foreground">Ready to use with your video</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={handleUploadClick}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/40 hover:border-border/70 transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={handleRemoveUpload}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <audio
                ref={audioRef}
                src={uploadedUrl}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            </div>
          ) : (
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 hover:border-accent/60 hover:bg-accent/10 transition-all text-center"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  <span className="text-xs font-mono text-muted-foreground">Uploading audio...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-accent/60" />
                  <span className="text-xs font-bold text-accent">Click to upload audio</span>
                  <span className="text-[10px] font-mono text-muted-foreground">MP3, WAV, M4A, AAC · Max {MAX_AUDIO_MB}MB</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* No sound */}
      {mode === "none" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/40">
          <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs font-bold text-foreground">No background music</p>
            <p className="text-[10px] font-mono text-muted-foreground">Video will be generated without audio</p>
          </div>
        </div>
      )}

      {/* Summary chip */}
      {mode !== "none" && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
          {mode === "upload" && uploadedUrl
            ? `Custom audio: ${fileName || "uploaded file"}`
            : mode === "preset"
            ? `Preset: ${selectedPreset?.label || "Auto Music"}`
            : ""}
        </div>
      )}

      {/* Upload note */}
      {mode === "upload" && (
        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          Your audio will be mixed with the generated video. If audio is longer than video, it will be trimmed with a fade-out. If shorter, it will loop smoothly.
        </p>
      )}
    </div>
  );
}