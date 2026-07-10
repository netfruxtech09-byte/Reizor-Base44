import { useState, useEffect, useRef } from "react";
import { ScanLine, Search, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";

export default function VendorScanner() {
  const [mode, setMode] = useState("idle"); // idle, scanning, result
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanHistory, setScanHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      let evs;
      if (user.role === "admin" || user.role === "organizer") {
        evs = await base44.entities.Event.filter({ status: "published" }, "-date", 50);
      } else if (user.assigned_events?.length) {
        evs = [];
        for (const eid of user.assigned_events) {
          const e = await base44.entities.Event.filter({ id: eid }, null, 1);
          if (e[0]) evs.push(e[0]);
        }
      } else {
        evs = await base44.entities.Event.filter({ status: "published" }, "-date", 50);
      }
      setEvents(evs);
      if (evs.length > 0) setSelectedEvent(evs[0].id);
      setLoading(false);
    };
    load();
  }, []);

  const extractTicketLookup = (raw) => {
    const trimmed = raw.trim();
    let ticketCode = trimmed;
    let ticketId = null;
    let qrCode = null;
    // Try JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.ticket_id) ticketId = parsed.ticket_id;
      if (parsed.ticketId) ticketId = parsed.ticketId;
      if (parsed.id) ticketId = parsed.id;
      if (parsed.code) ticketCode = parsed.code;
      if (parsed.ticket_code) ticketCode = parsed.ticket_code;
      if (parsed.qr_code) qrCode = parsed.qr_code;
    } catch {}
    // Try URL params
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://x.com${trimmed.startsWith("/") ? trimmed : "/"+trimmed}`);
      const p = url.searchParams.get("ticket_id") || url.searchParams.get("ticketId");
      if (p) ticketId = p;
    } catch {}
    return { ticketCode, ticketId, qrCode };
  };

  const validateTicket = async (code) => {
    setMode("scanning");
    const raw = code.trim();
    const { ticketCode, ticketId, qrCode } = extractTicketLookup(raw);

    // Multi-strategy lookup
    let ticket = null;

    // Strategy 1: by ticket_code
    const byCode = await base44.entities.Ticket.filter({ ticket_code: ticketCode.toUpperCase() }, null, 1);
    ticket = byCode[0] || null;

    // Strategy 2: by id
    if (!ticket && ticketId) {
      const byId = await base44.entities.Ticket.filter({ id: ticketId }, null, 1);
      ticket = byId[0] || null;
    }

    // Strategy 3: by qr_code field or raw value matching id/qr_code
    if (!ticket) {
      const allEvent = selectedEvent
        ? await base44.entities.Ticket.filter({ event_id: selectedEvent }, null, 500)
        : [];
      ticket = allEvent.find(t =>
        t.qr_code === raw ||
        t.qr_code === qrCode ||
        t.id === raw
      ) || null;
    }

    if (!ticket) {
      const scanResult = { status: "invalid", message: "Ticket not found", code: raw };
      setResult(scanResult);
      setScanHistory((prev) => [scanResult, ...prev].slice(0, 20));
      await base44.entities.Scan.create({
        ticket_code: ticketCode,
        event_id: selectedEvent || "",
        scanned_by_email: (await base44.auth.me()).email,
        result: "invalid",
        notes: "Ticket not found",
      });
      setMode("result");
      return;
    }

    if (selectedEvent && ticket.event_id !== selectedEvent) {
      const scanResult = { status: "invalid", message: "Wrong event", code: ticketCode, ticket };
      setResult(scanResult);
      setScanHistory((prev) => [scanResult, ...prev].slice(0, 20));
      setMode("result");
      return;
    }

    if (ticket.status === "scanned") {
      const scanResult = { status: "duplicate", message: "Already scanned", code: ticketCode, ticket };
      setResult(scanResult);
      setScanHistory((prev) => [scanResult, ...prev].slice(0, 20));
      await base44.entities.Scan.create({
        ticket_id: ticket.id,
        ticket_code: ticketCode,
        event_id: ticket.event_id,
        scanned_by_email: (await base44.auth.me()).email,
        result: "duplicate",
      });
      setMode("result");
      return;
    }

    if (ticket.status !== "active") {
      const scanResult = { status: "invalid", message: `Ticket is ${ticket.status}`, code: ticketCode, ticket };
      setResult(scanResult);
      setScanHistory((prev) => [scanResult, ...prev].slice(0, 20));
      setMode("result");
      return;
    }

    // Valid!
    const user = await base44.auth.me();
    await base44.entities.Ticket.update(ticket.id, {
      status: "scanned",
      scanned_at: new Date().toISOString(),
      scanned_by: user.email,
    });
    await base44.entities.Scan.create({
      ticket_id: ticket.id,
      ticket_code: ticketCode,
      event_id: ticket.event_id,
      scanned_by_email: user.email,
      result: "valid",
    });

    const scanResult = { status: "valid", message: "Entry approved", code: ticketCode, ticket };
    setResult(scanResult);
    setScanHistory((prev) => [scanResult, ...prev].slice(0, 20));
    setMode("result");
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateTicket(manualCode);
      setManualCode("");
    }
  };

  const reset = () => {
    setMode("idle");
    setResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link to="/" className="flex items-center gap-2 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Exit</span>
          </Link>
          <h1 className="font-display font-black text-lg tracking-tight">SCANNER</h1>
          <ScanLine className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Event Selector */}
        {events.length > 1 && (
          <select
            value={selectedEvent || ""}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 bg-white text-sm font-medium"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        )}

        {/* Result Display */}
        {mode === "result" && result && (
          <div
            className={`p-8 rounded-2xl text-center ${
              result.status === "valid"
                ? "bg-green-50 border-2 border-green-400"
                : result.status === "duplicate"
                ? "bg-amber-50 border-2 border-amber-400"
                : "bg-red-50 border-2 border-red-400"
            }`}
            onClick={reset}
          >
            {result.status === "valid" ? (
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
            ) : result.status === "duplicate" ? (
              <AlertTriangle className="w-20 h-20 text-amber-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="font-display font-black text-2xl mb-2 uppercase">
              {result.status === "valid" ? "VALID" : result.status === "duplicate" ? "DUPLICATE" : "INVALID"}
            </h2>
            <p className="text-gray-600 mb-4">{result.message}</p>
            {result.ticket && (
              <div className="text-left bg-white/60 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Name:</span> <strong>{result.ticket.owner_name}</strong></p>
                <p><span className="text-gray-500">Type:</span> {result.ticket.ticket_type_name}</p>
                <p className="font-mono text-xs text-gray-400">{result.code}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">Tap to scan next</p>
          </div>
        )}

        {mode === "scanning" && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Validating...</p>
          </div>
        )}

        {mode === "idle" && (
          <>
            {/* Manual Entry */}
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter ticket code..."
                  className="pl-10 h-14 text-lg font-mono uppercase bg-white border-gray-300"
                />
              </div>
              <Button type="submit" disabled={!manualCode.trim()} className="w-full h-14 bg-gray-900 text-white hover:bg-gray-800 font-display font-bold text-base">
                <ScanLine className="w-5 h-5 mr-2" />
                Validate Ticket
              </Button>
            </form>

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm text-gray-500 uppercase tracking-wider mb-3">
                  Recent Scans
                </h3>
                <div className="space-y-2">
                  {scanHistory.map((scan, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      scan.status === "valid" ? "border-green-200 bg-green-50" :
                      scan.status === "duplicate" ? "border-amber-200 bg-amber-50" :
                      "border-red-200 bg-red-50"
                    }`}>
                      {scan.status === "valid" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : scan.status === "duplicate" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate">{scan.code}</p>
                        <p className="text-[10px] text-gray-500">{scan.message}</p>
                      </div>
                      {scan.ticket && (
                        <span className="text-xs text-gray-500">{scan.ticket.owner_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}