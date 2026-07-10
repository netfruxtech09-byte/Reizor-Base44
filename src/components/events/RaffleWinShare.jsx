import { useState, useRef } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { safeShareWithImage } from "@/lib/mobileShare";

export default function RaffleWinShare({ raffle, event, userName }) {
  const [loading, setLoading] = useState(false);
  const cardRef = useRef(null);

  const eventUrl = `${window.location.origin}/events/${event?.id || ""}`;
  const eventTitle = event?.title || raffle?.event_title || "";
  const credit = raffle?.credit_amount ? `$${raffle.credit_amount} credit` : "a prize";
  const caption = `🎉 I just won ${credit} on Reizor!\n"${eventTitle}"\nCheck it out 👇\n${eventUrl}`;

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
    link.download = "raffle-win.png";
    link.click();
    toast.success("Image downloaded! Share it 🚀");
  };

  const handleShare = async () => {
    setLoading(true);
    const imgData = await generateImage();
    const result = await safeShareWithImage({
      title: "I won a raffle on Reizor! 🎉",
      text: caption,
      url: eventUrl,
      imageDataUrl: imgData,
      fileName: "raffle-win.png",
    });
    // If native share not available and we have an image, download it as fallback
    if (!result.success && result.reason !== "aborted" && imgData) {
      downloadImage(imgData);
    }
    setLoading(false);
  };

  return (
    <div className="mt-3 space-y-3">
      {/* Off-screen card for html2canvas — must be in DOM and positioned outside viewport */}
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

        {/* Event poster */}
        {event?.cover_image ? (
          <img
            src={event.cover_image}
            crossOrigin="anonymous"
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
            alt=""
          />
        ) : (
          <div style={{ width: "100%", height: 200, background: "rgba(255,27,141,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🏆</div>
        )}

        {/* Overlay gradient over poster */}
        <div style={{ position: "absolute", top: 140, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, #0d0520)" }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "24px 32px 28px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>🎉</div>
          <p style={{ fontSize: 30, fontWeight: 900, color: "#facc15", margin: 0, lineHeight: 1.1, letterSpacing: -0.5 }}>I WON!</p>
          {userName && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, fontWeight: 500 }}>{userName}</p>
          )}
          <div style={{ margin: "4px 0", padding: "8px 20px", borderRadius: 20, background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.4)" }}>
            <p style={{ color: "#facc15", fontSize: 18, fontWeight: 800, margin: 0 }}>{credit}</p>
          </div>
          {eventTitle && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 500, maxWidth: 300 }}>{eventTitle}</p>
          )}
          <p style={{ fontSize: 11, color: "#ff1b8d", fontWeight: 700, margin: "4px 0 0", letterSpacing: 0.5 }}>🎟 FREE TICKET WINNER</p>
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
        className="w-full gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-bold"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        {loading ? "Preparing..." : "Share Your Win 🎉"}
      </Button>
    </div>
  );
}