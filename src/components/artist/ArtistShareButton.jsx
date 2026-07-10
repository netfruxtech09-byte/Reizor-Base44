import { useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Check, AlertCircle } from "lucide-react";
import { APP_BASE_URL } from "@/lib/appUrl";

/**
 * ArtistShareButton — labeled "Copy Link" button that copies the artist's
 * public profile URL. Shows a high-visibility confirmation toast at the top
 * of the screen (above bottom nav + floating chat button).
 *
 * variant="card" — labeled pink outline button (default, for search cards)
 * variant="full"  — full-width labeled button
 */
export default function ArtistShareButton({ artist, variant = "card" }) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null); // { type: "success"|"error", msg: "" }

  if (!artist || artist.approval_status !== "approved") return null;

  const profileUrl = `${APP_BASE_URL}/artists/${artist.id}`;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl);
      } else {
        // Fallback for browsers without async clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = profileUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast("success", "Profile link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("error", "Unable to copy link. Please try again.");
    }
  };

  const widthClass = variant === "full" ? "w-full" : "w-fit";

  return (
    <>
      <button
        onClick={handleCopy}
        className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border-2 border-primary/50 text-primary hover:bg-primary/10 active:scale-95 transition-all text-sm font-bold min-h-[44px] ${widthClass}`}
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
        <span>{copied ? "Copied!" : "Copy Link"}</span>
      </button>

      {toast && createPortal(
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 72px)",
            background: toast.type === "success" ? "hsl(152 60% 16%)" : "hsl(0 60% 18%)",
            border: `1.5px solid ${toast.type === "success" ? "hsl(152 70% 45%)" : "hsl(0 70% 55%)"}`,
          }}
        >
          {toast.type === "success"
            ? <Check className="w-5 h-5 text-green-400 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          }
          <span className="text-sm font-bold text-white">{toast.msg}</span>
        </div>,
        document.body
      )}
    </>
  );
}