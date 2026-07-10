import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Star, Play, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { uploadToSpaces, recordStorageUsage } from "@/utils/spacesStorage";
import { toast } from "sonner";
import VideoUploadErrorPanel from "@/components/media/VideoUploadErrorPanel";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

const MAX_IMAGES = 10;
const MAX_FILE_MB = 500;
const COMPRESS_MAX_PX = 2048;   // resize any side > 2048px before upload
const COMPRESS_QUALITY = 0.88;  // JPEG quality for compressed output

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
// HEIC/HEIF: iOS camera outputs these — we accept and convert client-side
const HEIC_TYPES = ["image/heic", "image/heif"];

// All types we accept at the file-input level (browser accept attribute)
const FILE_INPUT_ACCEPT = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...HEIC_TYPES,
  // iOS Safari sometimes sends HEIC without a MIME type — accept by extension
  ".heic", ".heif",
].join(",");

// Extract YouTube video ID from any supported URL format
function extractYouTubeId(url) {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  return null;
}

export function isDirectVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

export function parseVideoUrl(url) {
  if (!url) return null;
  const s = url.trim();
  if (isDirectVideoUrl(s)) return s;
  const ytId = extractYouTubeId(s);
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}`;
  const vimeoMatch = s.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

/**
 * Compress/resize an image file before upload.
 * - Resizes any side > COMPRESS_MAX_PX proportionally.
 * - Converts HEIC/HEIF → JPEG (via canvas, which browsers handle after the OS
 *   converts HEIC to a decodable format when the file is drawn to canvas).
 * - Returns a new File object with corrected MIME type.
 */
async function compressImage(file) {
  const isHeic = HEIC_TYPES.includes(file.type) ||
    /\.(heic|heif)$/i.test(file.name);

  // For videos, skip compression entirely
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return file;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxSide = Math.max(width, height);

      if (!isHeic && maxSide <= COMPRESS_MAX_PX && file.type !== "image/heic" && file.type !== "image/heif") {
        // No resize needed and not HEIC — return original
        resolve(file);
        return;
      }

      // Resize if needed
      if (maxSide > COMPRESS_MAX_PX) {
        const scale = COMPRESS_MAX_PX / maxSide;
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const outName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
          resolve(new File([blob], outName, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        COMPRESS_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback: upload original
    };

    img.src = objectUrl;
  });
}

/**
 * Props:
 *   images          string[]  — current list of uploaded image URLs
 *   onImagesChange(urls)      — called when images change
 *   videoUrl        string    — current teaser video URL (raw)
 *   onVideoChange(url)        — called when video changes
 *   eventId         string    — used to build the Spaces folder path
 */
export default function EventMediaUploader({ images = [], onImagesChange, videoUrl = "", onVideoChange, eventId = "", afterImages = null }) {
  const [uploadingItems, setUploadingItems] = useState([]); // [{previewUrl, name}]
  const [videoInput, setVideoInput] = useState(videoUrl);
  const [videoError, setVideoError] = useState("");
  const [uploadFailed, setUploadFailed] = useState(false);
  const [failedFiles, setFailedFiles] = useState(null); // Files to retry
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState(null); // index awaiting removal confirmation

  // Persistent file input — always in the DOM (required for iOS WKWebView reliability)
  // Dynamically-created inputs that aren't appended to the DOM are silently dropped
  // by iOS Safari/WKWebView when the picker returns a selection.
  const fileInputRef = useRef(null);

  useEffect(() => {
    setVideoInput(videoUrl || "");
    setVideoError("");
  }, [videoUrl]);

  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);

    // Reset input value immediately so selecting the same file again triggers change
    // Must be done before any await, otherwise iOS may not fire the next change event
    e.target.value = "";

    if (!files.length) return;

    // Check capacity
    if (images.length + uploadingItems.length + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    // Filter: accept known image/video types + HEIC/unknown (iOS can give empty MIME)
    const rejected = files.filter(f => {
      const type = f.type.toLowerCase();
      const name = f.name.toLowerCase();
      const isKnownImage = ALLOWED_IMAGE_TYPES.includes(type);
      const isKnownVideo = ALLOWED_VIDEO_TYPES.includes(type);
      const isHeic = HEIC_TYPES.includes(type) || name.endsWith(".heic") || name.endsWith(".heif");
      const isMimeEmpty = !type; // iOS sometimes gives empty MIME for HEIC
      return !isKnownImage && !isKnownVideo && !isHeic && !isMimeEmpty;
    });

    if (rejected.length) {
      toast.error("Only JPG, PNG, WebP images or MP4/WebM/MOV videos are supported");
      return;
    }

    const oversized = files.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (oversized.length) {
      toast.error(`Max file size is ${MAX_FILE_MB}MB`);
      return;
    }

    // Create instant local previews (object URLs) — show immediately while uploading
    const newItems = files.map(f => ({
      previewUrl: ALLOWED_VIDEO_TYPES.includes(f.type) ? null : URL.createObjectURL(f),
      name: f.name,
      id: Math.random().toString(36).slice(2),
    }));
    setUploadingItems(prev => [...prev, ...newItems]);

    setFailedFiles(files);
    setUploadFailed(false);

    try {
      // Compress images in parallel (HEIC → JPEG, resize large images)
      const processedFiles = await Promise.all(
        files.map(f => ALLOWED_VIDEO_TYPES.includes(f.type) ? Promise.resolve(f) : compressImage(f))
      );

      // Upload in parallel to DigitalOcean Spaces
      const isVideo = (f) => ALLOWED_VIDEO_TYPES.includes(f.type);
      const uploadResults = await Promise.all(
        processedFiles.map(f => {
          const folder = eventId
            ? (isVideo(f) ? `events/${eventId}/videos` : `events/${eventId}/images`)
            : "events/general/images";
          return uploadToSpaces(f, folder);
        })
      );

      // Record storage usage for each file (fire-and-forget)
      uploadResults.forEach((result, i) => {
        const f = processedFiles[i];
        recordStorageUsage({
          file_url: result.file_url,
          file_size_bytes: result.file_size_bytes,
          mime_type: f.type,
          file_category: isVideo(f) ? "event_video" : "event_image",
          entity_type: "event",
          entity_id: eventId || "",
        }).catch(() => {});
      });

      // Replace preview items with final URLs
      const uploaded = uploadResults.map(r => r.file_url);
      onImagesChange([...images, ...uploaded]);
      setFailedFiles(null);
    } catch (err) {
      setUploadFailed(true);
      toast.error("Upload failed — please try again");
    } finally {
      // Remove uploading placeholders and revoke object URLs
      setUploadingItems(prev => {
        const remaining = prev.filter(item => !newItems.find(n => n.id === item.id));
        newItems.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        return remaining;
      });
    }
  }, [images, uploadingItems, onImagesChange]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const requestRemove = (idx) => setPendingRemoveIdx(idx);

  const confirmRemove = () => {
    if (pendingRemoveIdx === null) return;
    // Draft-only: remove from local state. The file is unlinked from the event
    // only when the parent saves. We do NOT delete from storage here so that
    // Cancel can fully restore the original media.
    onImagesChange(images.filter((_, i) => i !== pendingRemoveIdx));
    setPendingRemoveIdx(null);
  };

  const setAsCover = (idx) => {
    const next = [...images];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    onImagesChange(next);
    toast.success("Set as cover");
  };

  const handleVideoBlur = () => {
    const trimmed = videoInput.trim();
    if (!trimmed) { setVideoError(""); onVideoChange(""); return; }
    if (isDirectVideoUrl(trimmed)) { setVideoError(""); onVideoChange(trimmed); return; }
    const embed = parseVideoUrl(trimmed);
    if (embed) { setVideoError(""); onVideoChange(trimmed); }
    else { setVideoError("Only YouTube, Vimeo, or direct video file links are supported"); }
  };

  const clearVideo = () => { setVideoInput(""); setVideoError(""); onVideoChange(""); };

  const embedPreview = parseVideoUrl(videoInput);
  const isUploading = uploadingItems.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Images ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-accent font-mono uppercase tracking-wider font-bold">
            Event Images <span className="text-accent/60">({images.length}/{MAX_IMAGES})</span>
          </label>
          {images.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">First media = cover</span>
          )}
        </div>

        {/*
          Persistent file input — always in the DOM.
          iOS WKWebView silently drops change events from dynamically-created inputs
          that aren't attached to the DOM. Keeping this ref'd input always mounted
          is the only reliable approach for iOS.
          - accept includes .heic/.heif so iOS offers JPEG conversion option.
          - value is reset to "" immediately in onChange so re-selecting same file works.
        */}
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Uploaded images */}
          {images.map((url, idx) => (
            <div key={url + idx} className="relative group rounded-lg overflow-hidden aspect-video bg-card border border-border/50">
              {isDirectVideoUrl(url) ? (
                <video src={url} muted loop playsInline className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <img src={url} alt={`Event ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
              )}
              {isDirectVideoUrl(url) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/40 rounded-full p-1.5">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              )}
              {idx === 0 && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-primary text-primary-foreground text-[9px] font-mono font-bold px-1.5 py-0.5 rounded pointer-events-none">
                  <Star className="w-2.5 h-2.5" /> COVER
                </div>
              )}
              {/* Always-visible remove control — explicit, never triggered by tapping the image */}
              <button
                type="button"
                onClick={() => requestRemove(idx)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 hover:bg-destructive text-white border border-white/20 transition-colors"
                title="Remove image"
                aria-label="Remove image"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {/* Set as cover — only for non-cover images */}
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => setAsCover(idx)}
                  className="absolute bottom-1.5 left-1.5 p-1.5 rounded-full bg-black/60 hover:bg-primary text-white border border-white/20 transition-colors"
                  title="Set as cover"
                  aria-label="Set as cover"
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* In-progress upload previews */}
          {uploadingItems.map(item => (
            <div key={item.id} className="relative rounded-lg overflow-hidden aspect-video bg-card border border-primary/30">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="Uploading…" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full bg-secondary" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-[10px] font-mono text-white">Uploading…</span>
              </div>
            </div>
          ))}

          {/* Upload tile — hide if at max capacity or uploading */}
          {images.length + uploadingItems.length < MAX_IMAGES && (
            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-white/25 hover:border-primary/60 transition-colors cursor-pointer bg-card disabled:opacity-50"
            >
              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground text-center px-2">
                {images.length === 0 && uploadingItems.length === 0 ? "Upload image or video" : "Add more"}
              </span>
            </button>
          )}
        </div>
        {uploadFailed && failedFiles && (
          <div className="mt-3">
            <VideoUploadErrorPanel
              fileName={failedFiles[0]?.name}
              fileSize={failedFiles[0]?.size}
              fileType={failedFiles[0]?.type}
              module="event_media"
              relatedId={eventId}
              onRetry={() => {
                setUploadFailed(false);
                if (failedFiles?.length) {
                  // Re-trigger upload with saved files
                  const fakeEvent = { target: { files: failedFiles, value: "" } };
                  handleFileChange(fakeEvent);
                }
              }}
              onChooseAnother={() => {
                setUploadFailed(false);
                setFailedFiles(null);
                fileInputRef.current?.click();
              }}
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground font-mono mt-1.5">
          JPG, PNG, WebP, HEIC images · MP4, WebM, MOV videos · up to {MAX_IMAGES} items · Large files may take longer to upload.
        </p>
      </div>

      {/* ── Slot: content between images and video link ── */}
      {afterImages}

      {/* ── Teaser Video ── */}
      <div>
        <label className="text-xs text-accent font-mono uppercase tracking-wider font-bold block mb-2">
          External Video Link <span className="text-accent/60">(YouTube / Vimeo, optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={videoInput}
            onChange={e => { setVideoInput(e.target.value); setVideoError(""); }}
            onBlur={handleVideoBlur}
            placeholder="https://youtube.com/watch?v=... or vimeo.com/..."
            className={`flex-1 rounded-md bg-card border px-3 py-2 text-sm transition-colors hover:border-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring ${videoError ? "border-destructive" : "border-white/25"}`}
          />
          {videoInput && (
            <button onClick={clearVideo} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {videoError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
            <AlertCircle className="w-3 h-3" /> {videoError}
          </p>
        )}
        {embedPreview && !videoError && (
          <div className="mt-3 rounded-lg overflow-hidden aspect-video bg-black">
            {isDirectVideoUrl(videoInput) ? (
              <video src={embedPreview} controls muted loop playsInline className="w-full h-full object-contain" />
            ) : (
              <iframe
                src={embedPreview}
                className="w-full h-full"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                title="Video preview"
                width="100%"
                height="100%"
              />
            )}
          </div>
        )}
        <div className="p-3 rounded-lg bg-secondary/60 border border-accent/30 mt-3">
          <p className="text-sm text-foreground font-mono leading-relaxed">
            Supports YouTube, Vimeo links, or direct MP4/WebM video files
          </p>
        </div>
      </div>

      {/* Removal confirmation — draft-only, nothing is deleted from storage until Save */}
      <AlertDialog open={pendingRemoveIdx !== null} onOpenChange={(open) => { if (!open) setPendingRemoveIdx(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove image?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this image? This action will only be applied after saving changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <AlertDialogCancel className="mt-0">Keep Image</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}