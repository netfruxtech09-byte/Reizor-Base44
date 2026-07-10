import { useState, useEffect, useRef } from "react";
import { ScanLine, CheckCircle2, XCircle, Camera, Keyboard, RefreshCw, Trash2, ClipboardList, Wifi, WifiOff, CloudUpload } from "lucide-react";
import QRScannerWidget from "@/components/scanner/QRScannerWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { addToQueue, getQueuedScans, removeFromQueue, syncQueue, isOnline, onOnlineStatusChange } from "@/lib/offlineQueue";
import { toast } from "sonner";

export default function OrganizerScanner() {
  const feedback = (type) => {
    // Vibration
    if (navigator.vibrate) {
      navigator.vibrate(type === "valid" ? [80, 40, 80] : [200]);
    }
    // Sound via Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "valid") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  };

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [flashResult, setFlashResult] = useState(null); // big overlay feedback
  const flashTimerRef = useRef(null);
  const [history, setHistory] = useState([]);
  const lastScanRef = useRef({ text: "", time: 0 });
  const scanningRef = useRef(false);
  const [inputMode, setInputMode] = useState("manual");
  const [scannerInfo, setScannerInfo] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    onOnlineStatusChange(setOnline);
  }, []);

  useEffect(() => {
    (async () => {
      const queued = await getQueuedScans();
      setQueuedCount(queued.length);
    })();
  }, []);

  useEffect(() => {
    base44.auth.me().then(async user => {
      userRef.current = user;
      setScannerInfo({ name: user.full_name || user.email, role: user.role });
      let evs = [];
      if (user.role === "admin") {
        // Admin can scan any event — load all published events
        evs = await base44.entities.Event.filter({ status: "published" }, "-date", 100);
      } else if (user.role === "organizer") {
        // Organizer can scan their own events
        evs = await base44.entities.Event.filter({ organizer_id: user.id }, "-date", 100);
      } else {
        // Check if user has scan permission
        const perms = await base44.entities.Permission.filter({ user_email: user.email }, null, 1);
        if (perms.length > 0 && perms[0].can_scan_tickets && perms[0].status === "active") {
          // Load all published events
          evs = await base44.entities.Event.filter({ status: "published" }, "-date", 100);
        }
      }
      const active = evs.filter(e => e.status !== "cancelled");
      setEvents(active);
      if (active.length > 0) setSelectedEventId(active[0].id);
    });
  }, []);

  const showFlash = (res) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashResult(res);
    flashTimerRef.current = setTimeout(() => setFlashResult(null), 2500);
  };

  const scanCode = async (rawCode) => {
    const trimmed = rawCode.trim();
    if (!trimmed || !selectedEventId) return;
    // Prevent concurrent processing and immediate re-reads of the same QR
    if (scanningRef.current) return;
    const now = Date.now();
    if (lastScanRef.current.text === trimmed && (now - lastScanRef.current.time) < 5000) return;
    lastScanRef.current = { text: trimmed, time: now };
    scanningRef.current = true;
    setScanning(true);
    setResult(null);

    // Detect table reservation QR: "TBL-XXXXXXXX" (from QR or manual entry)
    if (trimmed.toUpperCase().startsWith("TBL-")) {
      const shortCode = trimmed.toUpperCase().slice(4);
      await scanTableReservation(shortCode, trimmed.toUpperCase());
      return;
    }

    // Legacy support: "TABLE:{fullId}" format
    if (trimmed.startsWith("TABLE:")) {
      const fullId = trimmed.slice(6);
      const results = await base44.entities.TableReservation.filter({ id: fullId }, null, 1).catch(() => []);
      const reservation = results[0];
      if (reservation) {
        const shortCode = reservation.id.slice(-8).toUpperCase();
        await scanTableReservation(shortCode, `TBL-${shortCode}`);
      } else {
        setResult({ status: "invalid", message: "Table reservation not found", code: trimmed, scanType: "table" });
        feedback("invalid");
        setHistory(h => [{ status: "invalid", code: trimmed, scanType: "table", time: new Date() }, ...h]);
        setScanning(false);
      }
      return;
    }

    // Otherwise treat as ticket code
    let ticketCode = trimmed;
    try {
      const parsed = JSON.parse(ticketCode);
      if (parsed.code) ticketCode = parsed.code;
    } catch {}
    ticketCode = ticketCode.toUpperCase();
    await scanTicket(ticketCode);
  };

  const scanTableReservation = async (shortCode, rawCode) => {
    // Fetch reservations for the selected event and match last 8 chars of id
    const all = await base44.entities.TableReservation.filter({ event_id: selectedEventId }, null, 200).catch(() => []);
    const reservation = all.find(r => r.id?.slice(-8).toUpperCase() === shortCode);

    if (!reservation) {
      const res = { status: "invalid", message: "Table reservation not found", code: rawCode, scanType: "table" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (reservation.event_id !== selectedEventId) {
      const res = { status: "invalid", message: "Reservation is for a different event", code: rawCode, reservation, scanType: "table" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (reservation.status === "checked_in") {
      const res = { status: "duplicate", message: "Already checked in", code: rawCode, reservation, scanType: "table", scannedAt: reservation.checked_in_at };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (reservation.status !== "reserved") {
      const res = { status: "invalid", message: `Reservation is ${reservation.status}`, code: rawCode, reservation, scanType: "table" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    // Valid — mark as checked in
    const user = userRef.current || await base44.auth.me();
    await base44.entities.TableReservation.update(reservation.id, {
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: user.email,
    }).catch(() => {});

    const res = { status: "valid", message: "Table reservation valid — entry granted", code: rawCode, reservation, scanType: "table" };
    setResult(res); showFlash(res);
    feedback("valid");
    setHistory(h => [{ ...res, time: new Date() }, ...h]);
    setScanning(false); scanningRef.current = false;
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const scanTicket = async (ticketCode) => {
    const tickets = await base44.entities.Ticket.filter({ ticket_code: ticketCode }, null, 1);
    const ticket = tickets[0];

    if (!ticket) {
      const res = { status: "invalid", message: "Ticket not found", code: ticketCode, scanType: "ticket" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (ticket.event_id !== selectedEventId) {
      const res = { status: "invalid", message: "Ticket is for a different event", code: ticketCode, ticket, scanType: "ticket" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (ticket.status === "scanned") {
      const res = { status: "duplicate", message: "Already scanned", code: ticketCode, ticket, scanType: "ticket", scannedAt: ticket.scanned_at };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    if (ticket.status !== "active") {
      const res = { status: "invalid", message: `Ticket is ${ticket.status}`, code: ticketCode, ticket, scanType: "ticket" };
      setResult(res); showFlash(res);
      feedback("invalid");
      setHistory(h => [{ ...res, time: new Date() }, ...h]);
      setScanning(false); scanningRef.current = false;
      return;
    }

    // Valid — mark as scanned
    const user = userRef.current || await base44.auth.me();
    const scanData = {
      ticket_id: ticket.id,
      ticket_code: ticketCode,
      event_id: ticket.event_id,
      scanned_by_email: user.email,
      result: "valid",
    };

    if (online) {
      try {
        await base44.entities.Ticket.update(ticket.id, {
          status: "scanned",
          scanned_at: new Date().toISOString(),
          scanned_by: user.email,
        });
        await base44.entities.Scan.create(scanData);

        // Award unified loyalty points for this attended event (ticket scan)
        base44.functions.invoke("awardScanLoyaltyPoints", { ticket_id: ticket.id }).catch(() => {});
      } catch {
        await addToQueue(scanData);
        setQueuedCount(q => q + 1);
        toast.info("Saved offline — will sync when online");
      }
    } else {
      await addToQueue(scanData);
      setQueuedCount(q => q + 1);
      toast.info("Offline — scan queued for sync");
    }

    const res = { status: "valid", message: "Valid ticket — entry granted", code: ticketCode, ticket, scanType: "ticket", offline: !online };
    setResult(res); showFlash(res);
    feedback("valid");
    setHistory(h => [{ ...res, time: new Date() }, ...h]);
    setScanning(false); scanningRef.current = false;
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    scanCode(code);
  };

  const handleSyncQueue = async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await syncQueue(async (scan) => {
        await base44.entities.Scan.create(scan);
      });
      setQueuedCount(0);
      toast.success(`Synced ${synced} scans${failed > 0 ? ` (${failed} failed)` : ""}`);
    } catch (err) {
      toast.error("Failed to sync queue");
    }
    setSyncing(false);
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const resultColors = {
    valid: "border-green-500/50 bg-green-500/10",
    duplicate: "border-yellow-500/50 bg-yellow-500/10",
    invalid: "border-destructive/50 bg-destructive/10",
  };
  const resultIcons = {
    valid: <CheckCircle2 className="w-12 h-12 text-green-400" />,
    duplicate: <RefreshCw className="w-12 h-12 text-yellow-400" />,
    invalid: <XCircle className="w-12 h-12 text-destructive" />,
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">TICKET SCANNER</h1>
          <p className="text-sm text-muted-foreground mt-1">Scan attendee tickets at the door</p>
        </div>
        <div className="text-right space-y-2">
          {scannerInfo && (
            <div>
              <p className="text-xs font-mono text-muted-foreground">Scanning as</p>
              <p className="font-display font-bold text-sm">{scannerInfo.name}</p>
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">{scannerInfo.role}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {online ? (
              <>
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-green-400 font-bold">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400 font-bold">Offline</span>
              </>
            )}
            {queuedCount > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-destructive font-bold">{queuedCount} queued</span>
                {online && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={handleSyncQueue}
                    disabled={syncing}
                    className="ml-1 h-5 gap-1 text-[10px] border-primary/40"
                  >
                    <CloudUpload className="w-3 h-3" />
                    Sync
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {events.length === 0 && (
        <div className="p-6 rounded-xl bg-card border border-border/50 text-center">
          <ScanLine className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="font-display font-bold">No scanner access</p>
          <p className="text-sm text-muted-foreground mt-1">Ask the event organizer to grant you scanner permission.</p>
        </div>
      )}

      {/* Event selector */}
      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Select Event</label>
        <select
          value={selectedEventId}
          onChange={e => { setSelectedEventId(e.target.value); setResult(null); }}
          className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm"
        >
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {ev.date ? format(new Date(ev.date), "MMM dd, yyyy") : "No date"}
            </option>
          ))}
        </select>
      </div>

      {/* Input mode toggle */}
      <div className="flex rounded-lg border border-border/50 overflow-hidden">
        <button
          onClick={() => setInputMode("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-mono font-bold transition-all ${
            inputMode === "manual" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Keyboard className="w-4 h-4" /> Manual Entry
        </button>
        <button
          onClick={() => setInputMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-mono font-bold transition-all ${
            inputMode === "camera" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Camera className="w-4 h-4" /> Scan QR
        </button>
      </div>

      {/* Input area */}
      {inputMode === "manual" ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Ticket code (TKT-ABC123) or Table code (TBL-2CFD5306)"
            className="bg-card border-border/50 font-mono"
            autoFocus
          />
          <Button type="submit" disabled={!code.trim() || scanning || !selectedEventId} className="glow-lime font-display font-bold shrink-0">
            {scanning ? "..." : "Scan"}
          </Button>
        </form>
      ) : (
        <div className="relative w-full">
          <QRScannerWidget
            onScan={scanCode}
            disabled={scanning}
            elementId="organizer-ticket-scanner"
            continuous={false}
          />
          {/* Large overlay feedback inside scanner area - only shown during camera scanning */}
          {flashResult && inputMode === "camera" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl pointer-events-auto"
              style={{
                background: flashResult.status === "valid"
                  ? "rgba(21,128,61,0.93)"
                  : "rgba(185,28,28,0.93)",
                animation: "fadeInScale 0.18s ease",
                zIndex: 50,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onClick={() => setFlashResult(null)}
            >
              {flashResult.status === "valid" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 96, height: 96, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <polyline points="6 12 10.5 16.5 18 8" />
                </svg>
              ) : flashResult.status === "duplicate" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 96, height: 96, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <line x1="8" y1="8" x2="16" y2="16" />
                  <line x1="16" y1="8" x2="8" y2="16" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 96, height: 96, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <line x1="8" y1="8" x2="16" y2="16" />
                  <line x1="16" y1="8" x2="8" y2="16" />
                </svg>
              )}
              <p className="font-display font-black text-white text-center leading-tight" style={{ fontSize: 26 }}>
                {flashResult.status === "valid"
                  ? (flashResult.scanType === "table" ? "TABLE CHECKED IN" : "TICKET CHECKED IN")
                  : flashResult.status === "duplicate"
                  ? (flashResult.scanType === "table" ? "ALREADY CHECKED IN" : "ALREADY SCANNED")
                  : "INVALID TICKET"}
              </p>
              <p className="text-white/80 font-mono text-sm text-center px-4">{flashResult.message}</p>
              {flashResult.ticket?.owner_name && (
                <p className="text-white font-bold font-display text-base">{flashResult.ticket.owner_name}</p>
              )}
              {flashResult.reservation?.buyer_name && (
                <p className="text-white font-bold font-display text-base">{flashResult.reservation.buyer_name}</p>
              )}
              <p className="text-white/50 font-mono text-xs mt-1">Tap to dismiss</p>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-5 rounded-xl border ${resultColors[result.status]} transition-all`}>
          <div className="flex flex-col items-center text-center gap-3">
            {resultIcons[result.status]}
            <div>
              <p className={`font-display font-black text-xl ${
                result.status === "valid" ? "text-green-400" :
                result.status === "duplicate" ? "text-yellow-400" : "text-destructive"
              }`}>
                {result.status === "valid" ? "ENTRY GRANTED" :
                 result.status === "duplicate" ? (result.scanType === "table" ? "ALREADY CHECKED IN" : "ALREADY SCANNED") : "INVALID"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
              {result.scanType && (
                <span className={`inline-block mt-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  result.scanType === "table" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                }`}>
                  {result.scanType === "table" ? "🪑 Table Reservation" : "🎟 Ticket"}
                </span>
              )}
            </div>

            {/* Ticket details */}
            {result.ticket && (
              <div className="w-full p-3 rounded-lg bg-background/60 text-left space-y-1">
                <p className="font-display font-bold">{result.ticket.owner_name || "Guest"}</p>
                <p className="text-xs text-muted-foreground font-mono">{result.ticket.owner_email}</p>
                <p className="text-xs font-mono mt-1">
                  <span className="text-primary font-bold">{result.ticket.ticket_type_name}</span>
                  {" · "}
                  <span className="text-muted-foreground">{result.ticket.ticket_code}</span>
                </p>
                {result.scannedAt && (
                  <p className="text-xs text-yellow-400 font-mono">
                    Previously scanned: {format(new Date(result.scannedAt), "MMM d, h:mm a")}
                  </p>
                )}
              </div>
            )}

            {/* Table reservation details */}
            {result.reservation && (
              <div className="w-full p-3 rounded-lg bg-background/60 text-left space-y-1">
                <p className="font-display font-bold">{result.reservation.buyer_name || "Guest"}</p>
                <p className="text-xs text-muted-foreground font-mono">{result.reservation.buyer_email}</p>
                <p className="text-xs font-mono mt-1">
                  <span className="text-accent font-bold">{result.reservation.table_name || "Table"}</span>
                  {result.reservation.seats && <span className="text-muted-foreground"> · {result.reservation.seats} seats</span>}
                </p>
                {result.reservation.event_title && (
                  <p className="text-xs text-muted-foreground font-mono">{result.reservation.event_title}</p>
                )}
                {result.scannedAt && (
                  <p className="text-xs text-yellow-400 font-mono">
                    Previously checked in: {format(new Date(result.scannedAt), "MMM d, h:mm a")}
                  </p>
                )}
              </div>
            )}

            {result.offline && (
              <p className="text-[11px] text-yellow-400 font-mono text-center pt-2 border-t border-yellow-400/20">
                ⚠ Offline — will sync when connection returns
              </p>
            )}
          </div>
        </div>
      )}

      {/* Scan History Log */}
      {history.length > 0 && (
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          {/* Header with counters */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Session Log</span>
              <span className="font-mono text-xs text-muted-foreground">({history.length} scan{history.length !== 1 ? "s" : ""})</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="text-green-400 font-bold">{history.filter(h => h.status === "valid").length}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                  <span className="text-yellow-400 font-bold">{history.filter(h => h.status === "duplicate").length}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                  <span className="text-destructive font-bold">{history.filter(h => h.status === "invalid").length}</span>
                </span>
              </div>
              <button onClick={() => setHistory([])} className="text-muted-foreground hover:text-destructive transition-colors" title="Clear log">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Log entries */}
          <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${
                h.status === "valid" ? "hover:bg-green-500/5" :
                h.status === "duplicate" ? "hover:bg-yellow-500/5" : "hover:bg-destructive/5"
              } transition-colors`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    h.status === "valid" ? "bg-green-400" :
                    h.status === "duplicate" ? "bg-yellow-400" : "bg-destructive"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {h.ticket?.owner_name || h.reservation?.buyer_name || h.code}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {h.ticket
                        ? `🎟 ${h.ticket.ticket_type_name} · ${h.ticket.ticket_code}`
                        : h.reservation
                          ? `🪑 ${h.reservation.table_name || "Table"}`
                          : h.code}
                    </p>
                    {(h.ticket?.owner_email || h.reservation?.buyer_email) && (
                      <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                        {h.ticket?.owner_email || h.reservation?.buyer_email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[10px] font-mono font-bold uppercase ${
                    h.status === "valid" ? "text-green-400" :
                    h.status === "duplicate" ? "text-yellow-400" : "text-destructive"
                  }`}>{h.status}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{format(h.time, "h:mm:ss a")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}