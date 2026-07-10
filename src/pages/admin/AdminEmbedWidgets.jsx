import { useState, useEffect } from "react";
import { Code2, Copy, Check, Monitor, ExternalLink, Home, Calendar, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PROD_BASE = "https://reizor.com";

const SIZES = {
  small:  { width: "100%", height: "400px",  label: "Small (400px)" },
  medium: { width: "100%", height: "600px",  label: "Medium (600px)" },
  large:  { width: "100%", height: "800px",  label: "Large (800px)" },
  full:   { width: "100%", height: "100vh",  label: "Full Viewport" },
};

function buildIframe(url, height) {
  return `<iframe
  src="${url}"
  width="100%"
  height="${height}"
  frameborder="0"
  style="border:none;border-radius:12px;overflow:hidden;"
  allowtransparency="true"
  loading="lazy"
></iframe>`;
}

function EmbedBlock({ label, url, height, onOpen }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const code = buildIframe(url, height);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Code block */}
      <div className="relative">
        <pre className="p-3 pr-10 rounded-lg bg-secondary/60 border border-border/50 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          {code}
        </pre>
        <button onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border/50 hover:border-primary/40 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-display font-bold text-sm hover:bg-primary/90 transition-all">
          {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Embed Code</>}
        </button>
        <button onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-secondary text-sm font-medium hover:border-primary/40 transition-all">
          <Monitor className="w-4 h-4" /> {showPreview ? "Hide Preview" : "Preview"}
        </button>
        {onOpen && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-secondary text-sm font-medium hover:border-accent/40 transition-all">
            <ExternalLink className="w-4 h-4" /> Open Page
          </a>
        )}
      </div>

      {/* Live preview */}
      {showPreview && (
        <div className="rounded-xl overflow-hidden border border-border/50 mt-2" style={{ height }}>
          <iframe src={url} width="100%" height="100%" frameBorder="0" style={{ border: "none" }} title={`Preview: ${label}`} />
        </div>
      )}
    </div>
  );
}

export default function AdminEmbedWidgets() {
  const [tab, setTab] = useState("home"); // "home" | "event"
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [size, setSize] = useState("medium");

  useEffect(() => {
    base44.entities.Event.filter({ status: "published" }, "-date", 200)
      .catch(() => base44.entities.Event.list("-date", 200).catch(() => []))
      .then(evts => {
        setEvents(evts);
        if (evts.length > 0) setSelectedEventId(evts[0].id);
        setLoadingEvents(false);
      });
  }, []);

  const { height } = SIZES[size];
  const homeUrl = PROD_BASE;
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventUrl = selectedEvent ? `${PROD_BASE}/events/${selectedEventId}` : "";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">EMBED WIDGETS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate iframe embed code for the Reizor home page or individual event pages.
          All embed URLs use <span className="font-mono text-primary">reizor.com</span>.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("home")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "home" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Home className="w-4 h-4" /> Home Page
        </button>
        <button onClick={() => setTab("event")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "event" ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Calendar className="w-4 h-4" /> Event Page
        </button>
      </div>

      {/* ── Global Size Picker ── */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Embed Height</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SIZES).map(([key, { label }]) => (
            <button key={key} onClick={() => setSize(key)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${size === key ? "bg-accent text-white border-accent" : "bg-secondary border-border/50 text-muted-foreground hover:border-accent/40"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground">Width is always 100% of the containing element. Height is fixed or full viewport.</p>
      </div>

      {/* ── HOME PAGE EMBED ── */}
      {tab === "home" && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">Reizor Home Page</p>
              <p className="text-xs text-muted-foreground font-mono">{homeUrl}</p>
            </div>
          </div>
          <EmbedBlock label="Home Page" url={homeUrl} height={height} onOpen />
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              ℹ️ The home page embed shows the full Reizor experience including events, artists, and discovery.
              Event views and ticket purchases from the embed are tracked normally.
            </p>
          </div>
        </div>
      )}

      {/* ── EVENT PAGE EMBED ── */}
      {tab === "event" && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">Event Page Embed</p>
              <p className="text-xs text-muted-foreground">Select an event and generate its embed code</p>
            </div>
          </div>

          {/* Event selector */}
          {loadingEvents ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-mono">Loading events…</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              No published events found.
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Select Event</p>
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2.5 text-sm appearance-none pr-8"
                >
                  {events.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title}{e.date ? ` — ${new Date(e.date).toLocaleDateString()}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Event details preview */}
          {selectedEvent && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
              {selectedEvent.cover_image && (
                <img src={selectedEvent.cover_image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{selectedEvent.title}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{eventUrl}</p>
              </div>
            </div>
          )}

          {/* Embed block */}
          {eventUrl && <EmbedBlock label={selectedEvent?.title || "Event"} url={eventUrl} height={height} onOpen />}

          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              ℹ️ The event embed includes full ticket purchase flow, promos, and guest list.
              All views, clicks, and purchases from the embed are tracked in the event's analytics.
              Admin controls are never exposed in the embed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}