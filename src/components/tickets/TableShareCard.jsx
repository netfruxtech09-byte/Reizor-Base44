import { useState, useRef } from "react";
import { Share2, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { APP_BASE_URL } from "@/lib/appUrl";

export default function TableShareCard({ reservation, event, bookingCode }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  const eventTitle = reservation?.event_title || event?.title || "";
  const tableName = reservation?.table_name || "";
  const eventId = reservation?.event_id || event?.id || "";
  const eventUrl = eventId
    ? `${APP_BASE_URL}/events/${eventId}`
    : `${APP_BASE_URL}/`;

  const eventDate = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const shareText = [
    `🪑 Table Reserved — ${eventTitle}`,
    tableName && `Table: ${tableName}`,
    reservation?.seats > 0 && `Guests: ${reservation.seats}`,
    eventDate && `Date: ${eventDate}`,
    event?.venue_name && `Venue: ${event.venue_name}${event.city ? `, ${event.city}` : ""}`,
    `Booking: ${bookingCode}`,
    `Event link: ${eventUrl}`,
  ].filter(Boolean).join("\n");

  // Copy link to clipboard with visual feedback
  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(`${shareText}`);
      } else {
        // Older iOS/Android fallback
        const ta = document.createElement("textarea");
        ta.value = shareText;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert(`Copy this link:\n${eventUrl}`);
    }
  };

  const generateImage = async () => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2,
        logging: false,
      });
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const handleShare = async () => {
    setLoading(true);

    const sharePayload = {
      title: `Table Reserved — ${eventTitle} 🪑`,
      text: shareText,
      url: eventUrl,
    };

    // Tier 1: Native share with image (mobile devices that support files)
    if (navigator.share) {
      try {
        // Try with image on supporting devices
        if (navigator.canShare) {
          const imgData = await generateImage();
          if (imgData) {
            try {
              const blob = await fetch(imgData).then(r => r.blob());
              const file = new File([blob], "table-reservation.png", { type: "image/png" });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ ...sharePayload, files: [file] });
                setLoading(false);
                return;
              }
            } catch {
              // image share failed, try without
            }
          }
        }

        // Tier 2: Native share without image
        await navigator.share(sharePayload);
        setLoading(false);
        return;
      } catch (e) {
        if (e.name === "AbortError") {
          setLoading(false);
          return;
        }
        // navigator.share failed — fall through to clipboard
      }
    }

    // Tier 3: Clipboard copy (desktop + unsupported webviews)
    setLoading(false);
    await copyToClipboard();
  };

  return (
    <div className="mt-1 space-y-2">
      {/* Off-screen card for html2canvas */}
      <div
        ref={cardRef}
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: 400,
          height: 500,
          background: "linear-gradient(135deg, #0d0520 0%, #1a0a3e 40%, #0a1530 100%)",
          borderRadius: 24,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: "Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Glow blobs */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,27,141,0.3)", filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(30,100,255,0.25)", filter: "blur(50px)", pointerEvents: "none" }} />

        {/* Event cover image */}
        {event?.cover_image ? (
          <img
            src={event.cover_image}
            crossOrigin="anonymous"
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
            alt=""
          />
        ) : (
          <div style={{ width: "100%", height: 200, background: "rgba(255,27,141,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🪑</div>
        )}

        {/* Gradient overlay */}
        <div style={{ position: "absolute", top: 140, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, #0d0520)" }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 1, textAlign: "center",
          padding: "20px 32px 28px", flex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>🪑</div>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#ff1b8d", margin: 0, lineHeight: 1.1, letterSpacing: -0.5 }}>
            TABLE RESERVED!
          </p>
          <div style={{ margin: "4px 0", padding: "10px 20px", borderRadius: 20, background: "rgba(255,27,141,0.15)", border: "1px solid rgba(255,27,141,0.4)" }}>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{eventTitle}</p>
            {tableName && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>{tableName}</p>
            )}
          </div>
          {eventDate && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 600 }}>{eventDate}</p>
          )}
          {event?.venue_name && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>{event.venue_name}{event.city ? `, ${event.city}` : ""}</p>
          )}
          {bookingCode && (
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: "monospace", letterSpacing: 1 }}>{bookingCode}</p>
          )}
          <div style={{ marginTop: 8, padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.08)" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, margin: 0, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>Reizor.com</p>
          </div>
        </div>
      </div>

      {/* Visible share button */}
      <Button
        onClick={handleShare}
        disabled={loading}
        size="sm"
        variant="outline"
        className={`w-full gap-2 font-display font-bold transition-colors ${
          copied
            ? "border-green-400/50 text-green-400 hover:bg-green-400/10"
            : "border-primary/40 text-primary hover:bg-primary/10"
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {loading ? "Preparing..." : copied ? "Link Copied!" : "Share Details 🪑"}
      </Button>
    </div>
  );
}