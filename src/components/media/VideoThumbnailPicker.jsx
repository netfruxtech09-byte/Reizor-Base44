import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Image, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadToSpaces } from "@/utils/spacesStorage";
import { toast } from "sonner";

/**
 * VideoThumbnailPicker
 * Allows the user to scrub a video and capture any frame as thumbnail.
 *
 * Props:
 *   videoUrl       string   — the uploaded video URL
 *   thumbnailUrl   string   — current thumbnail URL
 *   organizerId    string   — used to build upload folder path
 *   onChange(url)           — called when a thumbnail is selected & uploaded
 */
export default function VideoThumbnailPicker({ videoUrl, thumbnailUrl, organizerId, onChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Reset when videoUrl changes
  useEffect(() => {
    setVideoReady(false);
    setCurrentTime(0);
    setDuration(0);
    setCapturedDataUrl(null);
    setConfirmed(false);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    setVideoReady(true);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const handleScrub = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const val = parseFloat(e.target.value);
    v.currentTime = val;
    setCurrentTime(val);
    // Clear any previously captured frame when scrubbing
    setCapturedDataUrl(null);
    setConfirmed(false);
  };

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedDataUrl(dataUrl);
    setConfirmed(false);
  }, []);

  const handleUseThumbnail = async () => {
    if (!capturedDataUrl) return;
    setUploading(true);
    try {
      // Convert dataURL → Blob → File
      const res = await fetch(capturedDataUrl);
      const blob = await res.blob();
      const fileName = `thumb_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });

      const folder = organizerId
        ? `organizer/${organizerId}/thumbnails`
        : "organizer/thumbnails";
      const { file_url } = await uploadToSpaces(file, folder);

      onChange(file_url);
      setConfirmed(true);
      toast.success("Thumbnail saved!");
    } catch {
      toast.error("Failed to save thumbnail");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setCapturedDataUrl(null);
    setConfirmed(false);
    onChange("");
  };

  const formatTime = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Choose Video Thumbnail</span>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono">
        Move the slider to any frame, then press <strong>Use This Frame</strong> to set it as the video cover image.
      </p>

      {/* Hidden video element for scrubbing — muted, no controls */}
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        className="w-full rounded-lg bg-black max-h-40 object-contain"
        style={{ display: videoReady ? "block" : "block" }}
      />

      {!videoReady && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading video…
        </div>
      )}

      {/* Timeline scrubber */}
      {videoReady && duration > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>Move video to desired frame</span>
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={currentTime}
            onChange={handleScrub}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) ${(currentTime / duration) * 100}%, hsl(var(--muted)) ${(currentTime / duration) * 100}%)`,
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={captureFrame}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 text-xs"
          >
            <Camera className="w-3.5 h-3.5" />
            Capture This Frame
          </Button>
        </div>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview of captured frame */}
      {capturedDataUrl && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Captured Frame Preview</p>
          <div className="relative inline-block">
            <img
              src={capturedDataUrl}
              alt="Captured frame"
              className="w-40 h-24 object-cover rounded-lg border border-primary/30"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {!confirmed && (
              <Button
                type="button"
                size="sm"
                onClick={handleUseThumbnail}
                disabled={uploading}
                className="gap-2 glow-lime font-bold text-xs"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Use This Frame as Thumbnail</>
                )}
              </Button>
            )}
            {confirmed && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-green-400">
                <Check className="w-3.5 h-3.5" /> Thumbnail saved
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCapturedDataUrl(null)}
              className="gap-1.5 text-xs border-border/50 text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}

      {/* Show existing saved thumbnail if no new frame captured */}
      {!capturedDataUrl && thumbnailUrl && (
        <div className="flex items-start gap-3">
          <div className="relative">
            <img
              src={thumbnailUrl}
              alt="Current thumbnail"
              className="w-24 h-16 object-cover rounded-lg border border-border/50"
            />
            <span className="absolute -top-1.5 -left-1.5 text-[9px] font-mono bg-primary text-white px-1.5 py-0.5 rounded">
              Current
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <p className="text-xs text-muted-foreground font-mono">Thumbnail set</p>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-mono text-destructive hover:underline"
            >
              Remove thumbnail
            </button>
          </div>
        </div>
      )}

      {/* Upload-from-file fallback */}
      {!capturedDataUrl && (
        <p className="text-[10px] text-muted-foreground font-mono">
          Or{" "}
          <label className="text-primary cursor-pointer hover:underline">
            upload an image file
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("image")) { toast.error("Must be an image"); return; }
                setUploading(true);
                try {
                  const folder = organizerId ? `organizer/${organizerId}/thumbnails` : "organizer/thumbnails";
                  const { file_url } = await uploadToSpaces(file, folder);
                  onChange(file_url);
                  setConfirmed(true);
                  toast.success("Thumbnail uploaded");
                } catch {
                  toast.error("Upload failed");
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>{" "}
          instead
        </p>
      )}
    </div>
  );
}