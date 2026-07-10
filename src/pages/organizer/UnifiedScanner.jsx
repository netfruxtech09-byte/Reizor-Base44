import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Keyboard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  ScanLine,
  Ticket,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import QRScannerWidget from "@/components/scanner/QRScannerWidget";

const feedback = (type) => {
  if (navigator.vibrate) {
    navigator.vibrate(type === "valid" ? [80, 40, 80] : [200]);
  }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "valid") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
};

export default function UnifiedScanner() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [scanMode, setScanMode] = useState("both");
  const [inputMode, setInputMode] = useState("camera");
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [continuous, setContinuous] = useState(true);
  const [cameraActive, setCameraActive] = useState(false); // true while scanner camera is open

  const inputRef = useRef(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef({ text: "", time: 0 });
  const autoClearTimerRef = useRef(null);
  const continuousRef = useRef(continuous);
  const selectedEventIdRef = useRef(selectedEventId);
  const scanModeRef = useRef(scanMode);

  useEffect(() => { continuousRef.current = continuous; }, [continuous]);
  useEffect(() => { selectedEventIdRef.current = selectedEventId; }, [selectedEventId]);
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      let evs = [];

      if (user.role === "admin") {
        // Admin can scan any published event
        evs = await base44.entities.Event.filter(
          { status: "published" },
          "-date",
          100
        );
      } else if (user.role === "organizer") {
        // Organizer can scan their own events
        evs = await base44.entities.Event.filter(
          { organizer_id: user.id },
          "-date",
          100
        );
      } else {
        // Other users need scan permission
        const perms = await base44.entities.Permission.filter(
          { user_email: user.email },
          null,
          1
        );

        if (perms[0]?.can_scan_tickets && perms[0]?.status === "active") {
          evs = await base44.entities.Event.filter(
            { status: "published" },
            "-date",
            100
          );
        }
      }

      const active = evs.filter((e) => e.status !== "cancelled");
      setEvents(active);

      if (active.length > 0) {
        setSelectedEventId(active[0].id);
      }
    }).catch((err) => {
      console.error("[UnifiedScanner] Auth failed:", err);
      toast.error("Failed to load scanner. Please try again.");
    });
  }, []);

  // Handle QR scan from QRScannerWidget
  const handleQRScan = async (raw) => {
    if (!raw || scanningRef.current) return;

    // Secondary guard: if this exact code was just processed successfully (within 5s),
    // ignore repeated callbacks caused by the QR still being in camera frame.
    const now = Date.now();
    if (lastScanRef.current.text === raw && (now - lastScanRef.current.time) < 5000) return;

    // Cancel any pending auto-clear from a previous scan
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }
    scanningRef.current = true;
    setScanning(true);
    try {
      await processCode(raw);
      // After successful processing, record this code+time so re-reads are blocked
      lastScanRef.current = { text: raw, time: Date.now() };
    } finally {
      setScanning(false);
      scanningRef.current = false;
      // In continuous mode, auto-clear the result card after 3s so UI stays clean
      if (continuousRef.current) {
        autoClearTimerRef.current = setTimeout(() => {
          setResult(null);
          autoClearTimerRef.current = null;
        }, 3000);
      }
    }
  };

  // Extract ticket ID / code from any QR format
  const extractTicketId = (raw) => {
    const trimmed = raw.trim();
    let ticketCode = trimmed;
    let ticketId = null;
    let qrCode = null;
    let orderId = trimmed;
    let reservationId = null;
    let scannedTs = null;

    // Try JSON parse
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.ticket_id) ticketId = parsed.ticket_id;
      if (parsed.ticketId) ticketId = parsed.ticketId;
      if (parsed.id) ticketId = parsed.id;
      if (parsed.code) ticketCode = parsed.code;
      if (parsed.ticket_code) ticketCode = parsed.ticket_code;
      if (parsed.qr_code) qrCode = parsed.qr_code;
      if (parsed.order_id) orderId = parsed.order_id;
      if (parsed.booking_id) reservationId = parsed.booking_id;
      if (parsed.ts !== undefined) scannedTs = Number(parsed.ts);
    } catch {}

    // Try URL parse (e.g. /ticket/ID or ?ticket_id=ID)
    if (!ticketId) {
      try {
        // Handle relative paths like /ticket/abc123
        const fullUrl = trimmed.startsWith("http") ? trimmed : `https://x.com${trimmed.startsWith("/") ? trimmed : "/" + trimmed}`;
        const url = new URL(fullUrl);
        const tIdParam = url.searchParams.get("ticket_id") || url.searchParams.get("ticketId");
        if (tIdParam) ticketId = tIdParam;
        // /ticket/{id} or /check-in/{id}
        const pathMatch = url.pathname.match(/\/(?:ticket|check-in|tickets)\/([a-z0-9]+)/i);
        if (pathMatch) ticketId = pathMatch[1];
      } catch {}
    }

    return { ticketCode, ticketId, qrCode, orderId, reservationId, scannedTs };
  };

  const processCode = async (raw) => {
    const trimmed = raw.trim();
    const currentEventId = selectedEventIdRef.current;
    const currentScanMode = scanModeRef.current;

    if (!trimmed || !currentEventId) {
      toast.error("Please select an event and scan a QR code");
      return;
    }

    const { ticketCode, ticketId, qrCode, orderId, reservationId, scannedTs } = extractTicketId(trimmed);

    const addLog = (res) => {
      setResult(res);
      setHistory((h) => [{ ...res, time: new Date() }, ...h]);
    };

    // Check for expired rotating QR
    if (scannedTs !== null) {
      const currentSlot = Math.floor(Date.now() / 30000);
      if (scannedTs < currentSlot - 1) {
        feedback("invalid");
        addLog({ status: "invalid", message: "QR code expired. Ask attendee to show their live ticket screen.", code: trimmed });
        return;
      }
    }

    try {
      // ── Ticket lookup ──────────────────────────────────────────────────────
      if (currentScanMode !== "tables") {
        let ticket = null;

        // Strategy 1: by ticket_code
        const byCode = await base44.entities.Ticket.filter({ ticket_code: ticketCode.toUpperCase() }, null, 1);
        ticket = byCode[0] || null;

        // Strategy 2: by id
        if (!ticket && ticketId) {
          const byId = await base44.entities.Ticket.filter({ id: ticketId }, null, 1);
          ticket = byId[0] || null;
        }

        // Strategy 3: by qr_code field
        if (!ticket && qrCode) {
          const allEvent = await base44.entities.Ticket.filter({ event_id: currentEventId }, null, 500);
          ticket = allEvent.find(t => t.qr_code === qrCode) || null;
        }

        // Strategy 4: raw value as qr_code / id
        if (!ticket) {
          const allEvent = await base44.entities.Ticket.filter({ event_id: currentEventId }, null, 500);
          ticket = allEvent.find(t =>
            t.qr_code === trimmed || t.id === trimmed || t.ticket_code === trimmed.toUpperCase()
          ) || null;
        }

        if (ticket) {
          if (ticket.event_id !== currentEventId) {
            feedback("invalid");
            addLog({ type: "ticket", status: "invalid", message: "Ticket is for a different event", code: trimmed, ticket });
            return;
          }
          if (ticket.status === "scanned") {
            feedback("invalid");
            addLog({ type: "ticket", status: "duplicate", message: "Already scanned", code: trimmed, ticket, scannedAt: ticket.scanned_at });
            return;
          }
          if (ticket.status !== "active") {
            feedback("invalid");
            addLog({ type: "ticket", status: "invalid", message: `Ticket is ${ticket.status}`, code: trimmed, ticket });
            return;
          }

          const user = await base44.auth.me();
          await base44.entities.Ticket.update(ticket.id, {
            status: "scanned",
            scanned_at: new Date().toISOString(),
            scanned_by: user.email,
          });
          base44.functions.invoke("awardScanLoyaltyPoints", { ticket_id: ticket.id }).catch(() => {});

          feedback("valid");
          addLog({ type: "ticket", status: "valid", message: "Valid ticket. Entry granted.", code: trimmed, ticket });
          setCode("");
          setTimeout(() => inputRef.current?.focus(), 100);
          return;
        }
      }

      // ── Table reservation lookup ───────────────────────────────────────────
      if (currentScanMode !== "tickets") {
        let reservations = [];

        if (reservationId) {
          const allForEvent = await base44.entities.TableReservation.filter({ event_id: currentEventId }, null, 500);
          const byId = allForEvent.find((r) => r.id === reservationId);
          if (byId) {
            reservations = [byId];
          } else {
            const globalLookup = await base44.entities.TableReservation.filter({ id: reservationId }, null, 1);
            if (globalLookup[0]) reservations = globalLookup;
          }
        }

        if (!reservations[0] && trimmed.toUpperCase().startsWith("TBL-")) {
          const shortId = trimmed.slice(4).toLowerCase();
          const allRes = await base44.entities.TableReservation.filter({ event_id: currentEventId }, null, 200);
          reservations = [allRes.find((r) => r.id?.slice(-8).toLowerCase() === shortId)].filter(Boolean);
        }

        if (!reservations[0]) {
          reservations = await base44.entities.TableReservation.filter({ event_id: currentEventId, order_id: orderId }, null, 1);
        }

        if (!reservations[0]) {
          const allRes = await base44.entities.TableReservation.filter({ event_id: currentEventId }, null, 200);
          reservations = [allRes.find((r) => r.order_id === orderId || r.buyer_email?.toLowerCase() === trimmed.toLowerCase())].filter(Boolean);
        }

        const reservation = reservations[0];

        if (reservation) {
          if (reservation.status === "checked_in") {
            feedback("invalid");
            addLog({ type: "table", status: "duplicate", message: "Already checked in", code: trimmed, reservation });
            return;
          }
          if (reservation.status === "cancelled") {
            feedback("invalid");
            addLog({ type: "table", status: "invalid", message: "Reservation cancelled", code: trimmed, reservation });
            return;
          }

          await base44.entities.TableReservation.update(reservation.id, { status: "checked_in" });
          feedback("valid");
          addLog({ type: "table", status: "valid", message: "Table reservation confirmed. Entry granted.", code: trimmed, reservation });
          setCode("");
          setTimeout(() => inputRef.current?.focus(), 100);
          return;
        }
      }

      // ── Nothing found ──────────────────────────────────────────────────────
      feedback("invalid");
      addLog({ status: "invalid", message: "No ticket or reservation found for this code", code: trimmed });

    } catch (error) {
      console.error("[UnifiedScanner] processCode error:", error);
      feedback("invalid");
      addLog({ status: "invalid", message: error?.message || "Error processing QR code. Please try again.", code: trimmed });
      toast.error("Error processing QR: " + (error?.message || "Unknown error"));
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setScanning(true);
    scanningRef.current = true;

    try {
      await processCode(code);
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  };

  const validCount = history.filter((h) => h.status === "valid").length;
  const invalidCount = history.filter((h) => h.status !== "valid").length;

  const resultBg = {
    valid: "border-green-500/50 bg-green-500/10",
    duplicate: "border-yellow-500/50 bg-yellow-500/10",
    invalid: "border-destructive/50 bg-destructive/10",
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-24 sm:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" /> SCANNER
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scan tickets &amp; table reservations
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 font-bold">{validCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-destructive font-bold">{invalidCount}</span>
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Choose Event</label>
        {events.length === 0 ? (
          <div className="p-6 rounded-xl bg-card border border-border/50 text-center">
            <ScanLine className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-display font-bold">No events available</p>
          </div>
        ) : (
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setResult(null);
            }}
            className="w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm font-mono"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}{" "}
                {ev.date
                  ? `— ${format(new Date(ev.date), "MMM dd, yyyy")}`
                  : "— No date"}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
        {[
          { v: "both", label: "Both", icon: Zap },
          { v: "tickets", label: "Tickets", icon: Ticket },
          { v: "tables", label: "Tables", icon: UtensilsCrossed },
        ].map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setScanMode(v)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono font-bold transition-all ${
              scanMode === v
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {inputMode === "camera" && !cameraActive && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border border-border/50">
          <div>
            <p className="text-sm font-bold">Continuous Scan</p>
            <p className="text-xs text-muted-foreground font-mono">
              Camera stays open until Stop is clicked
            </p>
          </div>

          <button
            onClick={() => setContinuous((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              continuous ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                continuous ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      )}

      <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
        <button
          onClick={() => setInputMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono font-bold transition-all ${
            inputMode === "camera"
              ? "bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Camera className="w-4 h-4" /> Camera / QR
        </button>

        <button
          onClick={() => {
            setInputMode("manual");
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono font-bold transition-all ${
            inputMode === "manual"
              ? "bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Keyboard className="w-4 h-4" /> Manual
        </button>
      </div>

      {inputMode === "camera" && (
        <div className="space-y-3">
          {!selectedEventId && (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-center">
              <p className="text-sm font-bold text-yellow-400">Select an event above before scanning</p>
            </div>
          )}
          <div className="relative">
            <QRScannerWidget
              onScan={handleQRScan}
              disabled={!selectedEventId}
              continuous={continuous}
              onStateChange={(s) => setCameraActive(s === "active" || s === "requesting" || s === "attaching")}
            />
            {/* Result overlay inside scanner area */}
            {result && cameraActive && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl"
                style={{
                  background: result.status === "valid"
                    ? "rgba(21,128,61,0.93)"
                    : result.status === "duplicate"
                    ? "rgba(185,28,28,0.93)"
                    : "rgba(185,28,28,0.93)",
                  animation: "fadeInScale 0.18s ease",
                  zIndex: 50,
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                onClick={() => setResult(null)}
              >
                {result.status === "valid" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 96, height: 96, flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <polyline points="6 12 10.5 16.5 18 8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 96, height: 96, flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <line x1="8" y1="8" x2="16" y2="16" />
                    <line x1="16" y1="8" x2="8" y2="16" />
                  </svg>
                )}
                <p className="font-display font-black text-white text-center leading-tight" style={{ fontSize: 26 }}>
                  {result.status === "valid"
                    ? "ENTRY GRANTED"
                    : result.status === "duplicate"
                    ? "ALREADY SCANNED"
                    : "INVALID TICKET"}
                </p>
                <p className="text-white/80 font-mono text-sm text-center px-4">{result.message}</p>
                {(result.ticket?.owner_name || result.reservation?.buyer_name) && (
                  <p className="text-white font-bold font-display text-base">{result.ticket?.owner_name || result.reservation?.buyer_name}</p>
                )}
                <p className="text-white/50 font-mono text-xs mt-1">Tap to dismiss</p>
              </div>
            )}
          </div>
          {scanning && (
            <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-display font-bold text-primary text-sm">Processing QR…</p>
            </div>
          )}
        </div>
      )}

      {inputMode === "manual" && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter ticket code or order ID..."
            className="bg-card border-border/50 font-mono"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!code.trim() || scanning || !selectedEventId}
            className="glow-lime font-display font-bold shrink-0"
          >
            {scanning ? "..." : "Check"}
          </Button>
        </form>
      )}



      <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            Session Log {history.length > 0 ? `(${history.length})` : ""}
          </span>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs font-mono text-muted-foreground">No scans yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      h.status === "valid"
                        ? "bg-green-400"
                        : h.status === "duplicate"
                        ? "bg-yellow-400"
                        : "bg-destructive"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {h.ticket?.owner_name ||
                        h.reservation?.buyer_name ||
                        h.code}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {h.type === "ticket" ? "🎟 " : h.type === "table" ? "🪑 " : ""}
                      {h.ticket?.ticket_type_name ||
                        h.reservation?.table_name ||
                        h.message ||
                        h.code}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <p
                    className={`text-[10px] font-mono font-bold uppercase ${
                      h.status === "valid"
                        ? "text-green-400"
                        : h.status === "duplicate"
                        ? "text-yellow-400"
                        : "text-destructive"
                    }`}
                  >
                    {h.status === "valid" ? "✓ in" : h.status}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {format(h.time, "h:mm:ss a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}