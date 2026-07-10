import { useState, useRef } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { safeShareWithImage } from "@/lib/mobileShare";
import { APP_BASE_URL } from "@/lib/appUrl";

/**
 * Ticket branded share graphic — mirrors RaffleWinShare pattern exactly.
 * Renders an off-screen card, captures it with html2canvas,
 * then shares via Web Share API or falls back to download (desktop).
 */
export default function TicketShareCard({ ticket, event, userName }) {
   const [loading, setLoading] = useState(false);
   const cardRef = useRef(null);

   const eventTitle = ticket?.event_title || event?.title || "";
   const ticketType = ticket?.ticket_type_name || "";
   const ticketPrice = ticket?.price_paid || 0;
   const eventUrl = `${APP_BASE_URL}/events/${event?.id || ""}`;
   const caption = `🎟️ Just got my tickets to ${eventTitle}!\n${ticketType ? `${ticketType} ticket\n` : ""}${ticketPrice > 0 ? `$${ticketPrice.toFixed(2)}\n` : ""}Grab yours 👇\n${eventUrl}`;

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

  const downloadImage = (imgData) => {
    const link = document.createElement("a");
    link.href = imgData;
    link.download = `ticket-${ticket?.ticket_code || "share"}.png`;
    link.click();
    toast.success("Image downloaded! Share it on Instagram 🚀");
  };

  const handleShare = async () => {
    setLoading(true);
    const imgData = await generateImage();
    const result = await safeShareWithImage({
      title: `I'm going to ${eventTitle}! 🎟️`,
      text: caption,
      url: eventUrl,
      imageDataUrl: imgData,
      fileName: `ticket-${ticket?.ticket_code || "share"}.png`,
    });
    // safeShareWithImage handles clipboard/prompt toasts internally.
    // Only surface explicit errors here (non-abort failures with no fallback toast).
    if (!result.success && result.reason !== "aborted") {
      toast.error("Could not share. Please try copying the link manually.");
    }
    setLoading(false);
  };

  const eventDate = event?.date ? new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="mt-2 space-y-2">
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
          <div style={{ width: "100%", height: 200, background: "rgba(255,27,141,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🎟️</div>
        )}

        {/* Gradient overlay on image */}
        <div style={{ position: "absolute", top: 140, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, #0d0520)" }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 1, textAlign: "center",
          padding: "20px 32px 28px", flex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>🎟️</div>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#ff1b8d", margin: 0, lineHeight: 1.1, letterSpacing: -0.5 }}>
            I'M GOING!
          </p>
          {userName && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, fontWeight: 500 }}>{userName}</p>
          )}
          <div style={{ margin: "4px 0", padding: "10px 20px", borderRadius: 20, background: "rgba(255,27,141,0.15)", border: "1px solid rgba(255,27,141,0.4)" }}>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{eventTitle}</p>
            {ticketType && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: "4px 0 0", fontWeight: 600 }}>{ticketType}</p>
            )}
          </div>
          {eventDate && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 600 }}>{eventDate}</p>
          )}
          {event?.venue_name && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>{event.venue_name}{event.city ? `, ${event.city}` : ""}</p>
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
        className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10 font-display font-bold"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        {loading ? "Preparing..." : "Share Ticket 🎟️"}
      </Button>
    </div>
  );
}