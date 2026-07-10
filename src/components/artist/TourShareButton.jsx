import { useState } from "react";
import { Share2, X, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { safeShare } from "@/lib/mobileShare";
import { APP_BASE_URL } from "@/lib/appUrl";

export default function TourShareButton({ show, artistId, className = "" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${APP_BASE_URL}/artists/${artistId}/tour/${show.id}`;
  const text = `${show.venue_name} · ${show.artist_name || ""}`;

  const handleNativeShare = async () => {
    const result = await safeShare({ title: text, text, url });
    if (result.reason === "aborted") return;
    if (result.method === "native") { setOpen(false); return; }
    if (result.method === "clipboard" || result.method === "prompt") { setOpen(false); return; }
    setOpen(true);
  };

  const copyLink = async (e) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2500);
      setOpen(false);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const smsUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-mono font-bold min-h-[42px] w-full transition-all active:scale-95 touch-manipulation border ${copied ? "bg-green-400/20 text-green-400 border-green-400/30" : "border-border bg-secondary/70 text-foreground hover:bg-muted hover:border-primary/40"} ${className}`}
      >
        {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">Share</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Visible URL field with copy button */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-secondary/60 border border-border/40">
              <input
                readOnly
                value={url}
                className="flex-1 min-w-0 bg-transparent border-none text-[10px] font-mono text-muted-foreground focus:outline-none truncate px-1"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={copyLink}
                className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all ${copied ? "bg-green-400/20 text-green-400" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                title="Copy link"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="border-t border-border/30 pt-1.5 space-y-1">
              <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                <span className="text-[#25d366]">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </span>
                WhatsApp
              </a>
              <a href={smsUrl} onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                <span className="text-blue-400">💬</span> SMS
              </a>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                <span className="text-sky-400">𝕏</span> X / Twitter
              </a>
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
                <span className="text-blue-500">f</span> Facebook
              </a>
              <button onClick={copyLink}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm text-left ${copied ? "text-green-400" : "hover:bg-muted"}`}>
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><span>🔗</span> Copy Link</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}