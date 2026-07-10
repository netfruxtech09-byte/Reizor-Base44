import { useState, useEffect } from "react";
import { Copy, Check, Download, ExternalLink, QrCode, Link2, Users, BarChart3, Gift, X, Loader2, Code2 } from "lucide-react";
import { APP_BASE_URL, getAppUrl } from "@/lib/appUrl";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { safeShare, safeDownloadUrl, isAndroid, isIOS, isMobileWebView } from "@/lib/mobileShare";

function CopyButton({ value, label = "" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(label ? `${label} copied.` : "Link copied.");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-secondary border border-border/50 text-xs font-mono font-bold hover:border-primary/50 transition-colors shrink-0 whitespace-nowrap"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// Fetch blob with CORS fallback
async function fetchBlob(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("fetch failed");
  return res.blob();
}

function QRActionModal({ blob, blobUrl, imageUrl, filename, eventUrl, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Try file share first (image), then text share — safeShare handles all platforms
    if (blob && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Event QR Code", url: eventUrl });
          onClose();
          return;
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        // Fall through to text share
      }
    }
    const result = await safeShare({ title: "Event QR Code", url: eventUrl });
    if (result.reason !== "aborted") onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(eventUrl).then(() => {
      setCopied(true);
      toast.success("Event link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const src = blobUrl || imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar with close */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white font-display font-bold text-sm">QR Code</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 active:bg-white/30"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* QR image — large, centered, long-pressable */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
          <img
            src={src}
            alt="QR Code"
            className="w-full aspect-square object-contain"
            style={{ imageRendering: "pixelated", touchAction: "manipulation", WebkitUserSelect: "none", userSelect: "none" }}
            draggable={false}
          />
        </div>
      </div>

      {/* Hint */}
      <p className="text-white/50 text-[11px] font-mono text-center px-6 py-2 shrink-0">
        Long press the QR code above to save it to your device.
      </p>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2 shrink-0">
        <button
          onClick={handleShare}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-white font-display font-bold text-sm active:opacity-80 transition-opacity"
        >
          <Download className="w-4 h-4" />
          Share / Save QR Code
        </button>
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-display font-semibold text-sm active:opacity-80 transition-opacity"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "Link Copied!" : "Copy Event Link"}
        </button>
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white/60 font-display font-semibold text-sm active:opacity-80 transition-opacity"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function LinkRow({ label, url, icon: Icon, iconColor = "text-primary", qrUrl, qrFilename, openable = true, sellerId, showEmbed = false }) {
  const [showQR, setShowQR] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionModal, setActionModal] = useState(null); // { blob, blobUrl, imageUrl }
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const filename = qrFilename || "reizor-event-qr-code.png";
  
  // Generate embed code for seller (uses reizor.com domain)
  const embedUrl = `https://reizor.com/embed/seller/${sellerId}/profile`;
  const iframeCode = sellerId ? `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="500px"\n  frameborder="0"\n  style="border:none;border-radius:12px;"\n  allowtransparency="true"\n  loading="lazy"\n></iframe>` : "";

  const handleEmbedCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setEmbedCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await fetchBlob(qrUrl);
      const blobUrl = URL.createObjectURL(blob);

      if (!isMobileWebView() && !isIOS() && !isAndroid()) {
        // Desktop browser: direct anchor download
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
        toast.success("QR Code downloaded!");
        setDownloading(false);
        return;
      }

      // Mobile (iOS + Android): show action modal with the image for long-press save
      // The modal also provides a Share button via safeShare helpers
      setActionModal({ blob, blobUrl, imageUrl: qrUrl });
    } catch {
      toast.error("Could not load QR image. Try again.");
    }
    setDownloading(false);
  };

  return (
    <div className="space-y-2 py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 mb-1 shrink-0">
        {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />}
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground font-bold whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
        <input
          readOnly
          value={url}
          className="flex-1 min-w-0 rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm font-mono text-foreground truncate"
        />
        <CopyButton value={url} label={label} />
        {openable && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary border border-border/50 text-xs font-mono font-bold hover:border-accent/50 transition-colors shrink-0 whitespace-nowrap">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {qrUrl && (
          <button
            onClick={() => setShowQR(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-secondary border border-border/50 text-xs font-mono font-bold hover:border-accent/50 transition-colors shrink-0 whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR</span>
          </button>
        )}
      </div>
      {qrUrl && showQR && (
        <div className="flex flex-col items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
          <div className="flex items-center justify-center p-3 bg-white rounded-lg">
            <img src={qrUrl} alt={`${label} QR`} className="w-40 h-40 object-contain" style={{ imageRendering: "pixelated" }} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 font-mono text-xs"
            disabled={downloading}
            onClick={handleDownload}
          >
            {downloading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing...</>
              : <><Download className="w-3.5 h-3.5" /> Download QR Code</>
            }
          </Button>
        </div>
      )}

      {/* Embed Code Section */}
      {showEmbed && sellerId && (
        <>
          <button
            onClick={() => setShowEmbedCode(v => !v)}
            className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showEmbedCode ? "Hide Embed Code" : "Show Embed Code"}
          </button>
          {showEmbedCode && (
            <div className="space-y-2 p-3 rounded-lg bg-secondary/50 border border-border/30">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Embed Code</p>
              <div className="relative">
                <pre className="p-3 pr-10 rounded-lg bg-secondary/60 border border-border/50 text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {iframeCode}
                </pre>
                <button
                  onClick={handleEmbedCopy}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border/50 hover:border-primary/40 transition-colors"
                >
                  {embedCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5 font-mono text-xs"
                onClick={handleEmbedCopy}
              >
                {embedCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Embed Code</>}
              </Button>
            </div>
          )}
        </>
      )}

      {actionModal && (
        <QRActionModal
          blob={actionModal.blob}
          blobUrl={actionModal.blobUrl}
          imageUrl={actionModal.imageUrl}
          filename={filename}
          eventUrl={url}
          onClose={() => setActionModal(null)}
        />
      )}
    </div>
  );
}

/**
 * EventMarketingLinks
 * Props:
 *   eventId      — event id
 *   event        — event object (optional, if already loaded)
 *   sellerLinks  — array of SellerLink objects created during publish (optional, pass from CreateEvent)
 *   pollCreated  — boolean, was a poll created during this publish? (optional)
 *   giveawayCreated — boolean, was a giveaway created? (optional)
 *   compact      — boolean, compact mode (used in publish confirmation)
 */
export default function EventMarketingLinks({ eventId, event: eventProp, sellerLinks: sellerLinksProp, compact = false }) {
  const [event, setEvent] = useState(eventProp || null);
  const [sellerLinks, setSellerLinks] = useState(sellerLinksProp || []);
  const [polls, setPolls] = useState([]);
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);

  const origin = APP_BASE_URL;

  useEffect(() => {
    const eid = eventId || eventProp?.id;
    if (!eid) { setLoading(false); return; }

    // Load event + sellers first, then polls/giveaways staggered to avoid rate limits
    Promise.all([
      eventProp ? Promise.resolve(null) : base44.entities.Event.filter({ id: eid }, null, 1).catch(() => []),
      sellerLinksProp ? Promise.resolve(null) : base44.entities.SellerLink.filter({ event_id: eid }, "-created_date", 50).catch(() => []),
    ]).then(([evs, sellers]) => {
      if (evs && evs.length) setEvent(evs[0]);
      if (sellers) setSellerLinks(sellers);
      setLoading(false);
      // Load supplementary data after render
      Promise.all([
        base44.entities.EventPoll.filter({ event_id: eid }, "-created_date", 10).catch(() => []),
        base44.entities.EventGiveaway.filter({ event_id: eid }, "-created_date", 5).catch(() => []),
      ]).then(([pollsList, giveawaysList]) => {
        setPolls(pollsList || []);
        setGiveaways(giveawaysList || []);
      });
    });
  }, [eventId, eventProp?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const ev = event;
  if (!ev) return null;

  const eventUrl = `${origin}/events/${ev.id}`;
  const hasSellers = sellerLinks.length > 0;
  const hasPolls = polls.length > 0;
  const hasGiveaways = giveaways.length > 0;

  if (!ev.qr_code_url && !hasSellers && !hasPolls && !hasGiveaways && compact) {
    // Only show the basics in compact mode if nothing else
  }

  return (
    <div className={`rounded-xl bg-card border border-primary/20 ${compact ? "p-4" : "p-5"} space-y-1`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-primary" />
        <h3 className="font-display font-black text-sm uppercase tracking-wide text-primary">Your Event Links</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">All links for your event — share, copy, or download QR codes.</p>

      {/* Event Share Link */}
      <LinkRow
        label="Event Share Link"
        url={eventUrl}
        icon={ExternalLink}
        iconColor="text-primary"
        qrUrl={ev.qr_code_url}
        qrFilename={`event-${ev.id}-qr.png`}
      />

      {/* Vendor / Ticket Seller Links */}
      {hasSellers && (
        <div className="pt-3 space-y-1">
          <div className="flex items-center gap-2 mb-1 pt-1">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">Vendor / Ticket Seller Links</span>
          </div>
          {sellerLinks.map(seller => {
            const sellerUrl = `${origin}/events/${ev.id}?seller=${seller.tracking_code}`;
            return (
              <div key={seller.id} className="pl-2 border-l-2 border-accent/30 mb-2">
                <p className="font-display font-bold text-xs mb-1 text-foreground">{seller.promoter_name}</p>
                <LinkRow
                  label={`${seller.promoter_name} link`}
                  url={sellerUrl}
                  iconColor="text-accent"
                  qrUrl={seller.qr_code_url}
                  qrFilename={`seller-${seller.tracking_code}-qr.png`}
                  sellerId={seller.id}
                  showEmbed={true}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Poll Links */}
      {hasPolls && (
        <div className="pt-2 space-y-1">
          <div className="flex items-center gap-2 mb-1 pt-1">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-purple-400 font-bold">Poll Link{polls.length > 1 ? "s" : ""}</span>
          </div>
          {polls.map(p => {
            const pollUrl = `${origin}/events/${ev.id}?tab=poll`;
            return (
              <div key={p.id} className="pl-2 border-l-2 border-purple-400/30 mb-2">
                <p className="font-display font-bold text-xs mb-1 text-foreground truncate">{p.question || "Poll"}</p>
                <LinkRow
                  label="Poll link"
                  url={pollUrl}
                  iconColor="text-purple-400"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Raffle / Giveaway Links */}
      {hasGiveaways && (
        <div className="pt-2 space-y-1">
          <div className="flex items-center gap-2 mb-1 pt-1">
            <Gift className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-yellow-400 font-bold">Raffle / Giveaway Link{giveaways.length > 1 ? "s" : ""}</span>
          </div>
          {giveaways.map(g => {
            const raffleUrl = `${origin}/events/${ev.id}?tab=raffle`;
            return (
              <div key={g.id} className="pl-2 border-l-2 border-yellow-400/30 mb-2">
                <p className="font-display font-bold text-xs mb-1 text-foreground">
                  {g.items?.map(i => i.subject).filter(Boolean).join(", ") || "Raffle Giveaway"}
                </p>
                <LinkRow
                  label="Raffle link"
                  url={raffleUrl}
                  iconColor="text-yellow-400"
                />
              </div>
            );
          })}
        </div>
      )}

      {!hasSellers && !hasPolls && !hasGiveaways && (
        <p className="text-xs text-muted-foreground font-mono pt-1 pb-2">
          No vendor sellers, polls, or raffles were set up for this event.
        </p>
      )}
    </div>
  );
}