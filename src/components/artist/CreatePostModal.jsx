import { useState } from "react";
import { X, Upload, Music, Video, Image as ImageIcon, Calendar, Ticket, Gift, FileAudio, Plus, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const POST_TYPES = [
  { value: "media", label: "Media", icon: ImageIcon, desc: "Photo / Video / Audio" },
  { value: "event", label: "Event", icon: Calendar, desc: "Upcoming show" },
  { value: "ticket", label: "Ticket", icon: Ticket, desc: "Free / Discounted" },
  { value: "raffle", label: "Raffle", icon: Gift, desc: "Giveaway" },
  { value: "text", label: "Text", icon: Music, desc: "Text update" },
];

function MediaPreviewItem({ file, index, onRemove, onChange }) {
  const isVideo = file.type === "video" || file.type === "video360";
  const isImage = file.type === "image";
  const isAudio = file.type === "audio";

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-secondary/50">
      {/* Preview */}
      {isImage && (
        <div className="relative w-full aspect-video bg-black">
          <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
        </div>
      )}
      {isVideo && (
        <div className="relative w-full aspect-video bg-black">
          <video src={file.url} className="w-full h-full object-contain" controls playsInline />
          {file.type === "video360" && (
            <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full">
              360°
            </div>
          )}
        </div>
      )}
      {isAudio && (
        <div className="p-4 flex items-center gap-3 bg-secondary">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <FileAudio className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono truncate">{file.name}</p>
            <audio src={file.url} controls className="mt-1 w-full h-8" />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full">
            {file.type === "video360" ? "360° Video" : file.type}
          </span>
          <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>
          {file.type === "video" && (
            <button
              onClick={() => onChange(index, { ...file, type: "video360" })}
              className="shrink-0 text-[10px] text-accent border border-accent/40 px-2 py-0.5 rounded-full font-mono hover:bg-accent/10 transition-colors"
            >
              Mark 360°
            </button>
          )}
          {file.type === "video360" && (
            <button
              onClick={() => onChange(index, { ...file, type: "video" })}
              className="shrink-0 text-[10px] text-muted-foreground border border-border/50 px-2 py-0.5 rounded-full font-mono hover:bg-secondary transition-colors"
            >
              Remove 360°
            </button>
          )}
          <button
            onClick={() => onRemove(index)}
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-destructive/20 hover:bg-destructive/40 text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <Input
          value={file.title}
          onChange={e => onChange(index, { ...file, title: e.target.value })}
          placeholder="Add a title (optional)"
          className="bg-card border-border/40 text-sm h-8"
        />
        <div className="flex items-center gap-2">
          <Label className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">Date:</Label>
          <input
            type="date"
            value={file.date}
            onChange={e => onChange(index, { ...file, date: e.target.value })}
            className="flex-1 rounded-md bg-card border border-border/40 px-2.5 py-1 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
}

export default function CreatePostModal({ open, onClose, artist, events = [], onPostCreated }) {
  const [postType, setPostType] = useState("media");
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ event_id: "", event_title: "", event_date: "", ticket_link: "", ticket_price: "", ticket_original_price: "" });
  const [raffleForm, setRaffleForm] = useState({ prize_title: "", prize_description: "", terms_and_conditions: "", num_winners: 1, entry_requirement: "free", ends_at: "" });

  const reset = () => {
    setPostType("media");
    setCaption("");
    setMediaFiles([]);
    setUploading(false);
    setSaving(false);
    setForm({ event_id: "", event_title: "", event_date: "", ticket_link: "", ticket_price: "", ticket_original_price: "" });
    setRaffleForm({ prize_title: "", prize_description: "", terms_and_conditions: "", num_winners: 1, entry_requirement: "free", ends_at: "" });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        let type = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
        const name = file.name.toLowerCase();
        const likely360 = name.includes("360") || name.includes("vr") || name.includes("insta360") || name.includes("_00_");
        if (type === "video" && likely360) type = "video360";
        const today = new Date().toISOString().slice(0, 10);
        return { url: file_url, type, name: file.name, title: "", date: today };
      }));
      setMediaFiles(prev => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!artist || saving || uploading) return;
    setSaving(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const isAdmin = user?.role === "admin";
      const postData = {
        artist_id: artist.id,
        artist_name: artist.display_name,
        artist_image: artist.profile_image,
        type: postType,
        caption,
        media_urls: mediaFiles.map(f => f.url),
        media_types: mediaFiles.map(f => f.type),
        media_is360: mediaFiles.map(f => f.type === "video360"),
        media_titles: mediaFiles.map(f => f.title || ""),
        media_dates: mediaFiles.map(f => f.date || ""),
        approval_status: isAdmin ? "approved" : "pending_review",
      };

      if (postType === "event" || postType === "ticket") {
        Object.assign(postData, {
          event_id: form.event_id,
          event_title: form.event_title,
          event_date: form.event_date,
          ticket_link: form.ticket_link,
          ticket_price: form.ticket_price ? Number(form.ticket_price) : undefined,
          ticket_original_price: form.ticket_original_price ? Number(form.ticket_original_price) : undefined,
        });
      }

      const post = await base44.entities.ArtistPost.create(postData);

      if (postType === "raffle") {
        await base44.entities.ArtistRaffle.create({
          artist_id: artist.id,
          artist_name: artist.display_name,
          post_id: post.id,
          ...raffleForm,
          num_winners: Number(raffleForm.num_winners),
          ends_at: raffleForm.ends_at ? new Date(raffleForm.ends_at).toISOString() : undefined,
        });
      }

      onPostCreated(post);
      handleClose();
      if (postData.approval_status === "pending_review") {
        toast.success("Post submitted for review — it will go live after admin approval.");
      } else {
        toast.success("Post published!");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isBusy = uploading || saving;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="font-display font-black text-lg tracking-tight">Create Post</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Share with your fans</p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Post type selector */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Post Type</Label>
            <div className="grid grid-cols-5 gap-1">
              {POST_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setPostType(value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    postType === value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/40 bg-secondary/60 text-muted-foreground hover:border-primary/30 hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
              Caption
            </Label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              placeholder="Share what's on your mind with your fans..."
              className="w-full rounded-xl bg-secondary border border-border/40 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Media upload */}
          {postType === "media" && (
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
                Media Files
              </Label>

              <label className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
                uploading
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 hover:border-primary/40 hover:bg-secondary/40"
              }`}>
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm font-medium text-primary">Uploading files…</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">Click to upload media</p>
                      <p className="text-xs text-muted-foreground mt-1">Images, MP4, WAV, MP3, 360° video supported</p>
                    </div>
                    {mediaFiles.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-mono">
                        <Plus className="w-3 h-3" />
                        Add more files
                      </div>
                    )}
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.wav,.mp3,.flac,.insv,.insp"
                  className="hidden"
                  onChange={handleMediaUpload}
                  disabled={uploading}
                />
              </label>

              {/* Uploaded file previews */}
              {mediaFiles.length > 0 && (
                <div className="mt-3 space-y-3">
                  {mediaFiles.map((f, i) => (
                    <MediaPreviewItem
                      key={i}
                      file={f}
                      index={i}
                      onRemove={idx => setMediaFiles(m => m.filter((_, j) => j !== idx))}
                      onChange={(idx, updated) => setMediaFiles(m => m.map((x, j) => j === idx ? updated : x))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Event / Ticket fields */}
          {(postType === "event" || postType === "ticket") && (
            <div className="space-y-3">
              {events.length > 0 && (
                <div>
                  <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Link to Event</Label>
                  <select
                    value={form.event_id}
                    onChange={e => {
                      const ev = events.find(x => x.id === e.target.value);
                      setForm({ ...form, event_id: e.target.value, event_title: ev?.title || "", event_date: ev?.date || "" });
                    }}
                    className="w-full rounded-xl bg-secondary border border-border/40 px-3 py-2.5 text-sm"
                  >
                    <option value="">— Select event or enter manually —</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Event Title</Label>
                <Input value={form.event_title} onChange={e => setForm({ ...form, event_title: e.target.value })}
                  placeholder="Event name" className="bg-secondary border-border/40 rounded-xl" />
              </div>
              {postType === "ticket" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground mb-2 block">Ticket Price ($)</Label>
                    <Input type="number" value={form.ticket_price} onChange={e => setForm({ ...form, ticket_price: e.target.value })}
                      placeholder="0 = free" className="bg-secondary border-border/40 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground mb-2 block">Original Price ($)</Label>
                    <Input type="number" value={form.ticket_original_price} onChange={e => setForm({ ...form, ticket_original_price: e.target.value })}
                      placeholder="Retail price" className="bg-secondary border-border/40 rounded-xl" />
                  </div>
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground mb-2 block">Ticket URL</Label>
                    <Input value={form.ticket_link} onChange={e => setForm({ ...form, ticket_link: e.target.value })}
                      placeholder="https://..." className="bg-secondary border-border/40 rounded-xl" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Raffle fields */}
          {postType === "raffle" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-2 block">Prize Title *</Label>
                <Input value={raffleForm.prize_title} onChange={e => setRaffleForm({ ...raffleForm, prize_title: e.target.value })}
                  placeholder="e.g. 2x VIP Tickets" className="bg-secondary border-border/40 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-2 block">Prize Description</Label>
                <textarea value={raffleForm.prize_description} onChange={e => setRaffleForm({ ...raffleForm, prize_description: e.target.value })}
                  rows={2} placeholder="What does the winner get?"
                  className="w-full rounded-xl bg-secondary border border-border/40 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-2 block">Terms & Conditions</Label>
                <textarea value={raffleForm.terms_and_conditions} onChange={e => setRaffleForm({ ...raffleForm, terms_and_conditions: e.target.value })}
                  rows={2} placeholder="Raffle rules and eligibility..."
                  className="w-full rounded-xl bg-secondary border border-border/40 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs font-mono text-muted-foreground mb-2 block">No. of Winners</Label>
                  <Input type="number" min={1} value={raffleForm.num_winners} onChange={e => setRaffleForm({ ...raffleForm, num_winners: e.target.value })}
                    className="bg-secondary border-border/40 rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground mb-2 block">Entry Type</Label>
                  <select value={raffleForm.entry_requirement} onChange={e => setRaffleForm({ ...raffleForm, entry_requirement: e.target.value })}
                    className="w-full rounded-xl bg-secondary border border-border/40 px-3 py-2.5 text-sm">
                    <option value="free">Free Entry</option>
                    <option value="follow">Must Follow</option>
                    <option value="comment">Must Comment</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground mb-2 block">Ends At</Label>
                <Input type="datetime-local" value={raffleForm.ends_at} onChange={e => setRaffleForm({ ...raffleForm, ends_at: e.target.value })}
                  className="bg-secondary border-border/40 rounded-xl" />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border/40 shrink-0 flex gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={isBusy} className="flex-1 font-display font-bold rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            disabled={isBusy}
            className="flex-[2] font-display font-black rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
            ) : uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Publish Post</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}