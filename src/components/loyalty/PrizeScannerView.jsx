import { useState, useRef, useEffect } from "react";
import { Scan, Camera, Keyboard, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import QRScannerWidget from "@/components/scanner/QRScannerWidget";
import { format } from "date-fns";

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

export default function PrizeScannerView() {
  const [code, setCode] = useState("");
  const [inputMode, setInputMode] = useState("camera");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [continuous, setContinuous] = useState(true);

  const inputRef = useRef(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef({ text: "", time: 0 });
  const autoClearTimerRef = useRef(null);
  const continuousRef = useRef(continuous);

  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  const handleQRScan = async (raw) => {
    if (!raw || scanningRef.current) return;
    const now = Date.now();
    if (lastScanRef.current.text === raw && (now - lastScanRef.current.time) < 5000) return;
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }
    scanningRef.current = true;
    setScanning(true);
    try {
      await processPrizeCode(raw);
      lastScanRef.current = { text: raw, time: Date.now() };
    } finally {
      setScanning(false);
      scanningRef.current = false;
      if (continuousRef.current) {
        autoClearTimerRef.current = setTimeout(() => {
          setResult(null);
          autoClearTimerRef.current = null;
        }, 3000);
      }
    }
  };

  const processPrizeCode = async (raw) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;

    try {
      const res = await base44.functions.invoke("prizePrizeRedemption", {
        action: "redeem",
        redemption_code: trimmed,
      });

      if (res.data.success) {
        feedback("valid");
        setResult({
          status: "valid",
          message: "Prize claimed successfully",
          data: res.data.prize,
          time: new Date(),
        });
        setHistory(h => [{ status: "valid", data: res.data.prize, code: trimmed, time: new Date() }, ...h]);
        setCode("");
      }
    } catch (error) {
      const err = error.data || error;
      const errorMsg =
        err.status === "already_redeemed" ? "Already claimed"
        : err.status === "expired" ? "Prize expired"
        : err.error || "Prize not found";

      feedback("invalid");
      setResult({
        status: "invalid",
        message: errorMsg,
        code: trimmed,
        time: new Date(),
      });
      setHistory(h => [{ status: "invalid", message: errorMsg, code: trimmed, time: new Date() }, ...h]);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setScanning(true);
    scanningRef.current = true;
    try {
      await processPrizeCode(code);
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  };

  const validCount = history.filter(h => h.status === "valid").length;
  const invalidCount = history.filter(h => h.status !== "valid").length;

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-24 sm:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <Scan className="w-7 h-7 text-primary" /> PRIZE SCANNER
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scan or enter redemption codes</p>
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

      <div className="flex rounded-lg border border-border/50 overflow-hidden text-xs">
        <button
          onClick={() => setInputMode("camera")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono font-bold transition-all ${
            inputMode === "camera"
              ? "bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Camera className="w-4 h-4" /> Scan QR
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

      {inputMode === "camera" && !cameraActive && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border border-border/50">
          <div>
            <p className="text-sm font-bold">Continuous Scan</p>
            <p className="text-xs text-muted-foreground font-mono">Camera stays open until stopped</p>
          </div>
          <button
            onClick={() => setContinuous(v => !v)}
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

      {inputMode === "camera" && (
        <div className="space-y-3">
          <div className="relative">
            <QRScannerWidget
              onScan={handleQRScan}
              continuous={continuous}
              onStateChange={s => setCameraActive(s === "active" || s === "requesting" || s === "attaching")}
            />
            {result && cameraActive && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl"
                style={{
                  background: result.status === "valid"
                    ? "rgba(21,128,61,0.93)"
                    : "rgba(185,28,28,0.93)",
                  animation: "fadeInScale 0.18s ease",
                  zIndex: 50,
                }}
                onClick={() => setResult(null)}
              >
                {result.status === "valid" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" style={{ width: 96, height: 96 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <polyline points="6 12 10.5 16.5 18 8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" style={{ width: 96, height: 96 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <line x1="8" y1="8" x2="16" y2="16" />
                    <line x1="16" y1="8" x2="8" y2="16" />
                  </svg>
                )}
                <p className="font-display font-black text-white text-center text-2xl">
                  {result.status === "valid" ? "PRIZE CLAIMED" : "INVALID"}
                </p>
                <p className="text-white/80 font-mono text-sm text-center px-4">{result.message}</p>
              </div>
            )}
          </div>
          {scanning && (
            <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-display font-bold text-primary text-sm">Processing…</p>
            </div>
          )}
        </div>
      )}

      {inputMode === "manual" && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter redemption code..."
            className="bg-card border-border/50 font-mono"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!code.trim() || scanning}
            className="glow-lime font-display font-bold shrink-0"
          >
            {scanning ? "..." : "Check"}
          </Button>
        </form>
      )}

      <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            Log {history.length > 0 ? `(${history.length})` : ""}
          </span>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-muted-foreground hover:text-destructive">
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
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${h.status === "valid" ? "bg-green-400" : "bg-destructive"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{h.data?.title || h.message || h.code}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {h.data?.winner || h.code}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[10px] font-mono font-bold uppercase ${h.status === "valid" ? "text-green-400" : "text-destructive"}`}>
                    {h.status === "valid" ? "✓ OK" : "✗ FAIL"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{format(h.time, "h:mm:ss a")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}