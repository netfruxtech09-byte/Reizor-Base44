/**
 * VideoUploadErrorPanel
 *
 * Shown when a video upload fails. Provides friendly error message,
 * retry, choose-another, contact support, and send-error-to-support actions.
 */
import { useState } from "react";
import { AlertCircle, RefreshCw, FolderOpen, MessageCircle, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function VideoUploadErrorPanel({
  error,           // raw error message (not shown to user)
  fileName,
  fileSize,
  fileType,
  uploadProgress,  // percent reached when it failed
  module,          // e.g. "organizer_media", "artist_posts", "event_media"
  relatedId,       // event/post id if available
  onRetry,         // () => void
  onChooseAnother, // () => void
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const formatSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSendToSupport = async () => {
    setSending(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const report = {
        user_email: user?.email || "Unknown",
        user_name: user?.full_name || "Unknown",
        user_role: user?.role || "Unknown",
        module: module || "Unknown",
        file_name: fileName || "Unknown",
        file_size: formatSize(fileSize),
        file_type: fileType || "Unknown",
        upload_progress: uploadProgress != null ? `${uploadProgress}%` : "Unknown",
        timestamp: new Date().toISOString(),
        device: navigator.userAgent,
        platform: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
        related_id: relatedId || "N/A",
        error_message: error || "No error message captured",
      };

      // Create an admin notification with the report
      await base44.entities.Notification.create({
        user_email: "admin",
        title: `📤 Video Upload Error — ${user?.email || "Unknown User"}`,
        message: `Module: ${report.module}\nFile: ${report.file_name} (${report.file_size}, ${report.file_type})\nProgress when failed: ${report.upload_progress}\nUser: ${report.user_name} (${report.user_role})\nPlatform: ${report.platform}\nDevice: ${report.device.substring(0, 120)}\nError: ${report.error_message}\nTime: ${report.timestamp}\nRelated ID: ${report.related_id}`,
        type: "general",
      });

      setSent(true);
    } catch {
      // Even if notification fails, show a graceful message
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleContactSupport = () => {
    // Open support chat if available, otherwise open email
    const chatBtn = document.querySelector("[data-support-chat]");
    if (chatBtn) {
      chatBtn.click();
    } else {
      window.open("mailto:support@reizor.com?subject=Video%20Upload%20Issue&body=I%20am%20having%20trouble%20uploading%20a%20video.", "_blank");
    }
  };

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-display font-bold text-sm text-destructive">Video Upload Failed</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Your video could not be uploaded or processed. Please try again. If the issue continues,
            contact support or send the error details to us.
          </p>
          {fileName && (
            <p className="text-[10px] font-mono text-muted-foreground/70 mt-1.5">
              File: {fileName} · {formatSize(fileSize)}
              {uploadProgress != null && ` · Stopped at ${uploadProgress}%`}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry} className="gap-2 glow-lime font-bold font-display">
            <RefreshCw className="w-3.5 h-3.5" /> Retry Upload
          </Button>
        )}
        {onChooseAnother && (
          <Button size="sm" variant="outline" onClick={onChooseAnother} className="gap-2">
            <FolderOpen className="w-3.5 h-3.5" /> Choose Another Video
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleContactSupport} className="gap-2">
          <MessageCircle className="w-3.5 h-3.5" /> Contact Support
        </Button>
        {!sent ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSendToSupport}
            disabled={sending}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? "Sending..." : "Send Error to Support"}
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 px-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Error report sent to support.
          </span>
        )}
      </div>
    </div>
  );
}