import { useState, useRef, useEffect } from "react";
import { X, QrCode, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const POSITIONS = [
  { value: "top-left",     label: "Top Left",     style: { top: "5%",  left: "5%"  } },
  { value: "top-right",    label: "Top Right",    style: { top: "5%",  right: "5%" } },
  { value: "bottom-left",  label: "Bottom Left",  style: { bottom: "5%", left: "5%"  } },
  { value: "bottom-right", label: "Bottom Right", style: { bottom: "5%", right: "5%" } },
  { value: "center",       label: "Center",       style: { top: "50%", left: "50%", transform: "translate(-50%,-50%)" } },
];

/**
 * FlyerQROverlay
 * Props:
 *   flyerUrl    — the base flyer image URL
 *   qrUrl       — QR code image URL (already generated for the event)
 *   onSave      — called with the composited image data-URL (or original if no QR)
 *   onClose     — dismiss the modal
 */
export default function FlyerQROverlay({ flyerUrl, qrUrl, onSave, onClose }) {
  const [addQR, setAddQR]       = useState(null);   // null=asking, true, false
  const [position, setPosition] = useState(null);
  const [compositing, setCompositing] = useState(false);
  const canvasRef = useRef(null);

  // When position selected, draw preview on canvas
  useEffect(() => {
    if (!position || !flyerUrl || !qrUrl) return;
    drawComposite(flyerUrl, qrUrl, position, canvasRef.current);
  }, [position, flyerUrl, qrUrl]);

  const drawComposite = (flyerSrc, qrSrc, pos, canvas) => {
    if (!canvas) return;
    const flyer = new Image();
    flyer.crossOrigin = "anonymous";
    flyer.onload = () => {
      canvas.width  = flyer.naturalWidth;
      canvas.height = flyer.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(flyer, 0, 0);

      const qr = new Image();
      qr.crossOrigin = "anonymous";
      qr.onload = () => {
        // QR size = 18% of flyer width, min 80px
        const qrSize = Math.max(80, Math.round(flyer.naturalWidth * 0.18));
        const pad    = Math.round(flyer.naturalWidth * 0.04);

        let x, y;
        switch (pos) {
          case "top-left":     x = pad;                          y = pad; break;
          case "top-right":    x = flyer.naturalWidth - qrSize - pad; y = pad; break;
          case "bottom-left":  x = pad;                          y = flyer.naturalHeight - qrSize - pad; break;
          case "bottom-right": x = flyer.naturalWidth - qrSize - pad; y = flyer.naturalHeight - qrSize - pad; break;
          case "center":       x = (flyer.naturalWidth  - qrSize) / 2; y = (flyer.naturalHeight - qrSize) / 2; break;
          default:             x = pad; y = pad;
        }

        // White background behind QR for scannability
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 6, y - 6, qrSize + 12, qrSize + 12);
        ctx.drawImage(qr, x, y, qrSize, qrSize);
      };
      qr.src = qrSrc;
    };
    flyer.src = flyerSrc;
  };

  const handleSave = async () => {
    if (!addQR) {
      onSave(flyerUrl);
      return;
    }
    if (!position || !canvasRef.current) return;
    setCompositing(true);

    // Re-draw to ensure canvas is up-to-date
    await new Promise(resolve => {
      const flyer = new Image();
      flyer.crossOrigin = "anonymous";
      flyer.onload = () => {
        const canvas = canvasRef.current;
        canvas.width  = flyer.naturalWidth;
        canvas.height = flyer.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(flyer, 0, 0);

        const qr = new Image();
        qr.crossOrigin = "anonymous";
        qr.onload = () => {
          const qrSize = Math.max(80, Math.round(flyer.naturalWidth * 0.18));
          const pad    = Math.round(flyer.naturalWidth * 0.04);
          let x, y;
          switch (position) {
            case "top-left":     x = pad; y = pad; break;
            case "top-right":    x = flyer.naturalWidth - qrSize - pad; y = pad; break;
            case "bottom-left":  x = pad; y = flyer.naturalHeight - qrSize - pad; break;
            case "bottom-right": x = flyer.naturalWidth - qrSize - pad; y = flyer.naturalHeight - qrSize - pad; break;
            case "center":       x = (flyer.naturalWidth - qrSize) / 2; y = (flyer.naturalHeight - qrSize) / 2; break;
            default:             x = pad; y = pad;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - 6, y - 6, qrSize + 12, qrSize + 12);
          ctx.drawImage(qr, x, y, qrSize, qrSize);
          resolve();
        };
        qr.src = qrUrl;
      };
      flyer.src = flyerUrl;
    });

    // Convert canvas → blob → upload
    canvasRef.current.toBlob(async (blob) => {
      const file = new File([blob], "flyer-with-qr.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCompositing(false);
      onSave(file_url);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl space-y-5 p-6 relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-base">Add QR Code to Flyer?</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Step 1 — Yes / No */}
        {addQR === null && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              Include the event QR code on your flyer so fans can scan it directly to buy tickets.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAddQR(true)}
                className="p-4 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-center space-y-1"
              >
                <div className="text-2xl">✅</div>
                <p className="font-display font-bold text-sm text-primary">Yes, add QR</p>
                <p className="text-[10px] text-muted-foreground font-mono">Choose placement</p>
              </button>
              <button
                onClick={() => { setAddQR(false); onSave(flyerUrl); }}
                className="p-4 rounded-xl border-2 border-border/40 bg-secondary hover:bg-secondary/80 transition-all text-center space-y-1"
              >
                <div className="text-2xl">🚫</div>
                <p className="font-display font-bold text-sm">No, skip QR</p>
                <p className="text-[10px] text-muted-foreground font-mono">Save flyer as-is</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Position picker + preview */}
        {addQR === true && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">Select where to place the QR code on your flyer:</p>

            {/* Position grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {POSITIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPosition(p.value)}
                  className={`px-3 py-2.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    position === p.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/50 bg-secondary text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {position === p.value && <Check className="w-3 h-3 inline mr-1" />}
                  {p.label}
                </button>
              ))}
            </div>

            {/* Canvas preview */}
            {position ? (
              <div className="relative rounded-xl overflow-hidden border border-border/50 bg-black">
                <canvas ref={canvasRef} className="w-full max-h-72 object-contain" />
                <p className="text-[10px] text-muted-foreground font-mono text-center py-1.5 bg-muted/30">
                  Preview — QR placed at <strong>{POSITIONS.find(p => p.value === position)?.label}</strong>
                </p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-border/50 bg-black">
                <img src={flyerUrl} alt="Flyer" className="w-full max-h-64 object-contain" />
                <p className="text-[10px] text-muted-foreground font-mono text-center py-1.5 bg-muted/30">
                  Select a position above to preview QR placement
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setPosition(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                ← Change position
              </button>
              <Button
                onClick={handleSave}
                disabled={!position || compositing}
                className="flex-1 glow-lime font-display font-bold h-10"
              >
                {compositing ? "Processing..." : "✓ Save with QR"}
              </Button>
            </div>
          </div>
        )}

        {/* Hidden canvas for compositing */}
        {addQR !== true && <canvas ref={canvasRef} className="hidden" />}
      </div>
    </div>
  );
}