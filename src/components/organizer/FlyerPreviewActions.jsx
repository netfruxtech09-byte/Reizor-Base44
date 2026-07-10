import { useState } from "react";
import { Eye, Pencil, Trash2, X, Play, QrCode } from "lucide-react";
import FlyerQROverlay from "./FlyerQROverlay";

/**
 * FlyerPreviewActions — shows a flyer thumbnail with View / Edit / Delete / Add QR actions.
 *
 * Props:
 *   url        — flyer URL (image or video)
 *   type       — "image" | "video"   (auto-detected from url if omitted)
 *   qrUrl      — QR code URL for the event (optional — hides QR button if absent)
 *   onEdit     — called when user clicks Edit
 *   onDelete   — called when user clicks Delete
 *   onQRSaved  — called with new composited flyer URL after QR placement
 *   label      — optional label shown below the thumbnail
 */
export default function FlyerPreviewActions({ url, type, qrUrl, onEdit, onDelete, onQRSaved, label }) {
  const [viewOpen, setViewOpen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qrOverlayOpen, setQROverlayOpen] = useState(false);

  if (!url) return null;

  const isVideo = type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 border border-border/40">
        {/* Thumbnail */}
        <div
          className="shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted relative cursor-pointer group"
          onClick={() => setViewOpen(true)}
        >
          {isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-black/60">
              <Play className="w-6 h-6 text-white" />
            </div>
          ) : (
            <img src={url} alt="Flyer" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Eye className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Info + actions */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Selected Flyer</p>
          <p className="text-xs text-foreground font-medium">{label || (isVideo ? "🎬 Video flyer" : "🖼️ Image flyer")}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <button
              onClick={() => setViewOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/25 text-[11px] font-mono font-bold hover:bg-accent/20 transition-colors"
            >
              <Eye className="w-3 h-3" /> View
            </button>
            <button
              onClick={() => onEdit?.()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[11px] font-mono font-bold hover:bg-primary/20 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            {!isVideo && qrUrl && onQRSaved && (
              <button
                onClick={() => setQROverlayOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/25 text-[11px] font-mono font-bold hover:bg-yellow-400/20 transition-colors"
              >
                <QrCode className="w-3 h-3" /> Add QR
              </button>
            )}
            <button
              onClick={handleDelete}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors ${
                confirmDelete
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/20"
              }`}
            >
              <Trash2 className="w-3 h-3" /> {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {viewOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewOpen(false)}
        >
          <button
            onClick={() => setViewOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-lg w-full max-h-[90vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {isVideo ? (
              <video src={url} controls autoPlay playsInline className="max-w-full max-h-[85vh] rounded-xl" />
            ) : (
              <img src={url} alt="Flyer preview" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            )}
          </div>
        </div>
      )}

      {/* QR Overlay */}
      {qrOverlayOpen && (
        <FlyerQROverlay
          flyerUrl={url}
          qrUrl={qrUrl}
          onSave={(newUrl) => {
            setQROverlayOpen(false);
            onQRSaved?.(newUrl);
          }}
          onClose={() => setQROverlayOpen(false)}
        />
      )}
    </>
  );
}