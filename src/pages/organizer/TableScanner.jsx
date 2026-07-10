import { useState, useEffect, useRef } from "react";
import { Camera, Keyboard, CheckCircle2, XCircle, RefreshCw, ClipboardList, Trash2, Users, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import QRScannerWidget from "@/components/scanner/QRScannerWidget";

export default function TableScanner() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [inputMode, setInputMode] = useState("manual");
  const inputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      let evs = [];
      if (user.role === "admin" || user.role === "organizer") {
        evs = await base44.entities.Event.filter({ organizer_id: user.id }, "-date", 100);
      } else {
        evs = await base44.entities.Event.filter({ status: "published" }, "-date", 100);
      }
      const active = evs.filter((e) => e.status !== "cancelled");
      setEvents(active);
      if (active.length > 0) setSelectedEventId(active[0].id);
    });
  }, []);

  const feedback = (type) => {
    if (navigator.vibrate) navigator.vibrate(type === "valid" ? [80, 40, 80] : [200]);
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

  const processCode = async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed || !selectedEventId) return;
    setScanning(true);
    setResult(null);

    // Try to parse as JSON QR ({"code":"TKT-...","event":"...","type":"..."})
    let orderId = trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.order_id) orderId = parsed.order_id;
      else if (parsed.code) orderId = parsed.code;
    } catch {}

    // Look up TableReservation by order_id or buyer_email match
    const reservations = await base44.entities.TableReservation.filter(
      { event_id: selectedEventId, order_id: orderId },
      null, 1
    );

    let reservation = reservations[0];

    // If not found by order_id, try searching all reservations for this event
    if (!reservation) {
      const allRes = await base44.entities.TableReservation.filter({ event_id: selectedEventId }, null, 200);
      reservation = allRes.find(
        (r) => r.order_id === orderId || r.buyer_email?.toLowerCase() === orderId.toLowerCase()
      );
    }

    if (!reservation) {
      const res = { status: "invalid", message: "No table reservation found for this code", code: trimmed };
      setResult(res);
      feedback("invalid");
      setHistory((h) => [{ ...res, time: new Date() }, ...h]);
      setScanning(false);
      return;
    }

    if (reservation.status === "checked_in") {
      const res = { status: "duplicate", message: "Already checked in", code: trimmed, reservation };
      setResult(res);
      feedback("invalid");
      setHistory((h) => [{ ...res, time: new Date() }, ...h]);
      setScanning(false);
      return;
    }

    if (reservation.status === "cancelled") {
      const res = { status: "invalid", message: "Reservation is cancelled", code: trimmed, reservation };
      setResult(res);
      feedback("invalid");
      setHistory((h) => [{ ...res, time: new Date() }, ...h]);
      setScanning(false);
      return;
    }

    // Check in — update reservation
    await base44.entities.TableReservation.update(reservation.id, { status: "checked_in" });

    // Also update the linked order if exists
    if (reservation.order_id) {
      const orders = await base44.entities.Order.filter({ id: reservation.order_id }, null, 1);
      if (orders[0] && orders[0].status !== "checked_in") {
        await base44.entities.Order.update(orders[0].id, { status: "checked_in" });
      }
    }

    const res = {
      status: "valid",
      message: "Table reservation confirmed — entry granted",
      code: trimmed,
      reservation: { ...reservation, status: "checked_in" },
    };
    setResult(res);
    feedback("valid");
    setHistory((h) => [{ ...res, time: new Date() }, ...h]);
    setScanning(false);
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    processCode(code);
  };

  const handleQRScan = (text) => {
    processCode(text);
  };

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
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">TABLE SCANNER</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan buyer QR codes to check in table reservations</p>
      </div>

      {events.length === 0 && (
        <div className="p-6 rounded-xl bg-card border border-border/50 text-center">
          <ScanLine className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="font-display font-bold">No events available</p>
        </div>
      )}

      {/* Event selector */}
      <div>
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Select Event</label>
        <select
          value={selectedEventId}
          onChange={(e) => { setSelectedEventId(e.target.value); setResult(null); }}
          className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm"
        >
          {events.map((ev) => (
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

      {inputMode === "manual" ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter order ID or buyer email"
            className="bg-card border-border/50 font-mono"
            autoFocus
          />
          <Button type="submit" disabled={!code.trim() || scanning || !selectedEventId} className="glow-lime font-display font-bold shrink-0">
            {scanning ? "..." : "Scan"}
          </Button>
        </form>
      ) : (
        <QRScannerWidget
          onScan={handleQRScan}
          disabled={scanning}
          elementId="organizer-table-qr-reader"
          continuous={false}
        />
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
                {result.status === "valid" ? "CHECKED IN" :
                 result.status === "duplicate" ? "ALREADY CHECKED IN" : "INVALID"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            </div>
            {result.reservation && (
              <div className="w-full p-3 rounded-lg bg-background/60 text-left space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="font-display font-bold">{result.reservation.buyer_name || "Guest"}</p>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{result.reservation.buyer_email}</p>
                <p className="text-xs font-mono mt-1">
                  <span className="text-primary font-bold">{result.reservation.table_name || "Table"}</span>
                  {result.reservation.order_id && (
                    <span className="text-muted-foreground"> · Order: {result.reservation.order_id.slice(-8).toUpperCase()}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Log */}
      {history.length > 0 && (
        <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Session Log</span>
              <span className="font-mono text-xs text-muted-foreground">({history.length})</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="text-green-400 font-bold">{history.filter((h) => h.status === "valid").length}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                  <span className="text-destructive font-bold">{history.filter((h) => h.status !== "valid").length}</span>
                </span>
              </div>
              <button onClick={() => setHistory([])} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    h.status === "valid" ? "bg-green-400" :
                    h.status === "duplicate" ? "bg-yellow-400" : "bg-destructive"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{h.reservation?.buyer_name || h.code}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {h.reservation?.table_name || h.reservation?.buyer_email || h.code}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[10px] font-mono font-bold uppercase ${
                    h.status === "valid" ? "text-green-400" :
                    h.status === "duplicate" ? "text-yellow-400" : "text-destructive"
                  }`}>{h.status === "valid" ? "checked in" : h.status}</p>
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