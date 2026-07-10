import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Loader2, CheckCircle, Trash2, Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function detectIs360(name) {
  const n = (name || "").toLowerCase();
  return n.includes("360") || n.includes("vr") || n.includes("insv");
}

export default function EditOrganizerPostModal({ open, post, onClose, onUpdated }) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [is360, setIs360] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState("active");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !post) return;
    setCaption(post.caption || "");
    setMediaUrl(post.media_url || "");
    setMediaType(post.media_type || "image");
    setIs360(!!post.is_360);
    setThumbnailUrl(post.thumbnail_url || "");
    setStatus(post.status || "active");
  }, [open, post]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("sheet-open");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("sheet-open");
    };
  }, [open]);

  const handleMediaUpload = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const type = file.type.startsWith("video") ? "video" : "image";
      setMediaUrl(file_url);
      setMediaType(type);
      setIs360(type === "video" && detectIs360(file.name));
      // New media is not Mux-processed; clear stale streaming fields
      setThumbnailUrl("");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleThumbnailUpload = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setThumbnailUrl(file_url);
    } catch {
      toast.error("Thumbnail upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving || uploading || !post) return;
    setSaving(true);
    try {
      const mediaChanged = mediaUrl !== post.media_url;
      const payload = {
        caption,
        media_url: mediaUrl,
        media_type: mediaType,
        is_360: is360,
        thumbnail_url: thumbnailUrl,
        status,
      };
      if (mediaChanged) {
        // Clear Mux streaming fields — replaced media is not encoded
        payload.mux_asset_id = "";
        payload.mux_playback_id = "";
        payload.mux_playback_url = "";
        payload.mux_status = "idle";
        payload.mux_error_message = "";
        payload.desktop_optimized_url = "";
        payload.mobile_playback_url = "";
        payload.playback_status = "direct";
      }
      const updated = await base44.entities.OrganizerMediaPost.update(post.id, payload);
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
            <p className="text-xs text-muted-foreground mt-0.5">Update caption, media &amp; visibility</p>
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
          {/* Media preview */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Media</Label>
            {mediaUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border/60 bg-secondary/50">
                {mediaType === "video" ? (
                  <div className="w-full aspect-video bg-black">
                    <video src={mediaUrl} className="w-full h-full object-contain" muted playsInline preload="metadata" />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-black">
                    <img src={mediaUrl} className="w-full h-full object-contain" alt="" />
                  </div>
                )}
                {is360 && (
                  <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full">360°</span>
                )}
                <button
                  onClick={() => { setMediaUrl(""); setThumbnailUrl(""); }}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive transition-colors"
                  aria-label="Remove media"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            <label className={`mt-3 flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
              uploading ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-primary/40 hover:bg-secondary/40"
            }`}>
              {uploading ? (
                <><Loader2 className="w-5 h-5 text-primary animate-spin" /><span className="text-sm text-primary">Uploading…</span></>
              ) : (
                <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{mediaUrl ? "Replace media" : "Upload image or video"}</span></>
              )}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={isBusy} />
            </label>
          </div>

          {/* Thumbnail (videos only) */}
          {mediaType === "video" && (
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Thumbnail</Label>
              {thumbnailUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border/60 mb-2">
                  <img src={thumbnailUrl} alt="" className="w-full aspect-video object-cover" />
                  <button
                    onClick={() => setThumbnailUrl("")}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive transition-colors"
                    aria-label="Remove thumbnail"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}
              <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-all ${
                uploading ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-primary/40 hover:bg-secondary/40"
              }`}>
                {uploading ? (
                  <><Loader2 className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-primary">Uploading…</span></>
                ) : (
                  <><ImageIcon className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">{thumbnailUrl ? "Replace thumbnail" : "Upload custom thumbnail"}</span></>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} disabled={isBusy} />
              </label>
            </div>
          )}

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

          {/* Visibility */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStatus("active")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-display font-bold transition-all ${
                  status === "active" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Eye className="w-4 h-4" /> Visible
              </button>
              <button
                onClick={() => setStatus("hidden")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-display font-bold transition-all ${
                  status === "hidden" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <EyeOff className="w-4 h-4" /> Hidden
              </button>
            </div>
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
    </div>,
    document.body
  );
}