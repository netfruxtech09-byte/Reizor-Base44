import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Loader2, CheckCircle, Trash2, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

function MediaThumb({ item, onRemove }) {
  const isVideo = item.type === "video" || item.type === "video360";
  const isAudio = item.type === "audio";
  return (
    <div className="relative rounded-xl overflow-hidden border border-border/60 bg-secondary/50">
      {isVideo ? (
        <div className="w-full aspect-video bg-black">
          <video src={item.url} className="w-full h-full object-contain" muted playsInline preload="metadata" />
        </div>
      ) : isAudio ? (
        <div className="p-4 flex items-center gap-2 bg-secondary">
          <FileAudio className="w-5 h-5 text-primary shrink-0" />
          <span className="text-xs truncate">{item.title || "Audio clip"}</span>
        </div>
      ) : (
        <div className="w-full aspect-video bg-black">
          <img src={item.url} className="w-full h-full object-contain" alt="" />
        </div>
      )}
      {item.type === "video360" && (
        <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full">360°</span>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive transition-colors"
        aria-label="Remove media"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function EditPostModal({ open, post, isAdmin, onClose, onUpdated }) {
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState([]);
  const [coverImage, setCoverImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    if (pendingRemoval.type === "media") {
      setMedia(prev => prev.filter((_, j) => j !== pendingRemoval.index));
    }
    setPendingRemoval(null);
  };

  // Lock background scroll and hide the floating help bubble while the modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("sheet-open");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("sheet-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open || !post) return;
    setCaption(post.caption || "");
    setCoverImage(post.cover_image || "");
    const urls = post.media_urls || [];
    setMedia(urls.map((url, i) => ({
      url,
      type: post.media_types?.[i] || "image",
      title: post.media_titles?.[i] || "",
      date: post.media_dates?.[i] || "",
      thumbnail: post.media_thumbnails?.[i] || "",
    })));
  }, [open, post]);

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        let type = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
        const name = file.name.toLowerCase();
        if (type === "video" && (name.includes("360") || name.includes("vr") || name.includes("insv"))) type = "video360";
        return { url: file_url, type, title: "", date: new Date().toISOString().slice(0, 10), thumbnail: "" };
      }));
      setMedia(prev => [...prev, ...uploaded]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving || uploading || !post) return;
    setSaving(true);
    try {
      const payload = {
        caption,
        media_urls: media.map(m => m.url),
        media_types: media.map(m => m.type),
        media_is360: media.map(m => m.type === "video360"),
        media_titles: media.map(m => m.title || ""),
        media_dates: media.map(m => m.date || ""),
        media_thumbnails: media.map(m => m.thumbnail || ""),
        cover_image: coverImage || "",
      };
      const updated = await base44.entities.ArtistPost.update(post.id, payload);
      toast.success("Post updated successfully.");
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update post.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !post) return null;
  const isBusy = uploading || saving;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="font-display font-black text-lg tracking-tight">Edit Post</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Update caption &amp; media
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Caption */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Caption</Label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-secondary border border-border/40 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Media */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
              Media (images / videos / audio)
            </Label>
            {media.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {media.map((m, i) => (
                  <MediaThumb key={i} item={m} onRemove={() => setPendingRemoval({ type: "media", index: i })} />
                ))}
              </div>
            )}
            <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
              uploading ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-primary/40 hover:bg-secondary/40"
            }`}>
              {uploading ? (
                <><Loader2 className="w-5 h-5 text-primary animate-spin" /><span className="text-sm text-primary">Uploading…</span></>
              ) : (
                <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Add more media</span></>
              )}
              <input type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={handleMediaUpload} disabled={isBusy} />
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/40 shrink-0 flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isBusy} className="flex-1 font-display font-bold rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isBusy}
            className="flex-[2] font-display font-black rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Save Changes</>
            )}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(o) => { if (!o) setPendingRemoval(null); }}
        title="Remove this media?"
        description="This will remove it from the post. The change is saved only after you click Save Changes."
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={confirmRemoval}
      />
    </div>,
    document.body
  );
}