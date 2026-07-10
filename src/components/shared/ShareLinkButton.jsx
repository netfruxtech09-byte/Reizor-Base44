import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { safeShare } from "@/lib/mobileShare";

/**
 * ShareLinkButton — enlarged, clear share/copy-link control with visible feedback.
 *
 * - Tries native share (mobile + supported desktop browsers).
 * - Fallback: shows a read-only URL field + a "Copy Link" button with a visible "Copied" state.
 * - Toast "Link copied" on success.
 * - Min 44px tap target for mobile.
 */
export default function ShareLinkButton({ url, title, text, label = "Share", className = "", size = "default" }) {
  const [copied, setCopied] = useState(false);
  const [showLinkField, setShowLinkField] = useState(false);

  const handleShare = async () => {
    const result = await safeShare({ title, text, url });
    if (result.reason === "aborted") return;
    if (result.method === "native") return;
    // Native share not available — show copy-link field and auto-copy
    setShowLinkField(true);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard failed — still show the field so user can copy manually
    }
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        type="button"
        onClick={handleShare}
        className={`flex items-center justify-center gap-2 ${sizeClass} font-display font-bold rounded-lg border-2 border-primary/40 text-primary hover:bg-primary/10 transition-all min-h-[44px] ${className}`}
      >
        <Share2 className={iconSize} /> {label}
      </button>
      {showLinkField && (
        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-card border border-border/50">
          <input
            readOnly
            value={url}
            className="flex-1 min-w-0 bg-transparent border-none text-xs font-mono text-muted-foreground focus:outline-none truncate px-1"
            onClick={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all min-h-[40px] ${
              copied
                ? "bg-green-400/20 text-green-400 border border-green-400/30"
                : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
            }`}
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
          </button>
        </div>
      )}
    </div>
  );
}