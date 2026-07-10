import { useState, useEffect } from "react";
import { Share2, Bookmark, BookmarkCheck, X, Copy, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * ShareSaveBar — reusable Share + Save actions for Raffles, Giveaways, and Polls.
 *
 * Props:
 *   activityType: "raffle" | "giveaway" | "poll"
 *   activityId:   string
 *   activityTitle: string
 *   eventId:      string (optional)
 *   eventTitle:   string (optional)
 *   shareUrl:     string (full URL to share)
 *   shareText:    string (short description for share message)
 *   size:         "sm" (default, compact header use) | "lg" (larger, easier to tap)
 */
export default function ShareSaveBar({
  activityType,
  activityId,
  activityTitle,
  eventId,
  eventTitle,
  shareUrl,
  shareText,
  size = "sm",
}) {
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = shareUrl || window.location.href;
  const title = activityTitle || "Check this out on Reizor";
  const text = shareText ? `${title} — ${shareText}` : title;

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!u?.email) return;
      base44.entities.SavedActivity.filter(
        { user_email: u.email, activity_type: activityType, activity_id: activityId },
        null, 1
      ).then(results => {
        if (results[0]) {
          setSaved(true);
          setSavedRecordId(results[0].id);
        }
      }).catch(() => {});
    }).catch(() => {});
  }, [activityType, activityId]);

  const handleSave = async () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    if (savingBusy) return;
    setSavingBusy(true);
    if (saved && savedRecordId) {
      await base44.entities.SavedActivity.delete(savedRecordId).catch(() => {});
      setSaved(false);
      setSavedRecordId(null);
      toast.success("Removed from saved activities");
    } else {
      const rec = await base44.entities.SavedActivity.create({
        user_id: user.id,
        user_email: user.email,
        activity_type: activityType,
        activity_id: activityId,
        activity_title: title,
        event_id: eventId || "",
        event_title: eventTitle || "",
      }).catch(() => null);
      if (rec) {
        setSaved(true);
        setSavedRecordId(rec.id);
        toast.success(`Saved "${title}"! Find it on your Saved page.`);
      }
    }
    setSavingBusy(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or not supported — fall through to menu
      }
    }
    setShowShareMenu(s => !s);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  const isLg = size === "lg";
  const btnClass = isLg
    ? "flex items-center gap-2 h-12 min-w-[52px] px-4 rounded-xl border text-sm font-mono font-bold transition-colors touch-manipulation"
    : "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-mono transition-colors touch-manipulation";
  const iconClass = isLg ? "w-5 h-5" : "w-4 h-4";

  return (
    <div className="flex items-center gap-2">
      {/* Share button */}
      <button
        onClick={handleNativeShare}
        className={`${btnClass} bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-accent/40`}
        style={{ WebkitTapHighlightColor: "transparent" }}
        title="Share"
      >
        <Share2 className={iconClass} />
        <span className={isLg ? "inline" : "hidden sm:inline"}>Share</span>
      </button>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={savingBusy}
        className={`${btnClass} ${
          saved
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
        title={saved ? "Unsave" : "Save"}
      >
        {saved ? <BookmarkCheck className={iconClass} /> : <Bookmark className={iconClass} />}
        <span className={isLg ? "inline" : "hidden sm:inline"}>{saved ? "Saved" : "Save"}</span>
      </button>

      {/* Share menu — rendered as a full-viewport portal bottom sheet so it's never
          clipped by a parent's overflow/sticky header, and respects iOS safe areas. */}
      {showShareMenu && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShareMenu(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Share via</span>
              <button
                onClick={() => setShowShareMenu(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors -mr-1.5"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setShowShareMenu(false)}
              className="flex items-center gap-3 px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors text-sm touch-manipulation">
              <span className="text-xl">💬</span> WhatsApp
            </a>
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setShowShareMenu(false)}
              className="flex items-center gap-3 px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors text-sm touch-manipulation">
              <span className="text-xl">✈️</span> Telegram
            </a>
            <button onClick={copyLink}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 active:bg-muted/60 transition-colors text-sm touch-manipulation">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}