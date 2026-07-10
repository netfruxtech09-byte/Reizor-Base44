import { useState } from "react";
import { Copy, Check, Code2, Monitor, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { APP_BASE_URL } from "@/lib/appUrl";

const BASE_URL = APP_BASE_URL;

const SIZES = {
  small:  { width: "100%", height: "300px", label: "Small" },
  medium: { width: "100%", height: "500px", label: "Medium" },
  full:   { width: "100%", height: "700px", label: "Full Width" },
};

export default function EmbedCodePanel({ type, id, widgets }) {
  // type = "organizer" | "artist"
  // widgets = array of { key, label, path }
  const [selected, setSelected] = useState(widgets[0]?.key || "");
  const [size, setSize] = useState("medium");
  const [theme, setTheme] = useState("dark");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const widget = widgets.find(w => w.key === selected) || widgets[0];
  const embedPath = widget?.path || "";
  const embedUrl = `${BASE_URL}/embed/${type}/${id}/${embedPath}?theme=${theme}`;
  const { width, height } = SIZES[size];

  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="${width}"\n  height="${height}"\n  frameborder="0"\n  style="border:none;border-radius:12px;"\n  allowtransparency="true"\n  loading="lazy"\n></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 p-5 rounded-xl bg-card border border-border/50">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Code2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-display font-bold text-sm">Add Reizor to Your Website</p>
          <p className="text-sm text-muted-foreground leading-relaxed">Copy this code and paste it into your website where you want the widget to appear.</p>
        </div>
      </div>

      {/* Widget selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Widget</label>
        <div className="flex flex-wrap gap-2">
          {widgets.map(w => (
            <button key={w.key} onClick={() => setSelected(w.key)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${selected === w.key ? "bg-primary text-white border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Options row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Size</label>
          <div className="flex gap-1.5">
            {Object.entries(SIZES).map(([key, { label }]) => (
              <button key={key} onClick={() => setSize(key)}
                className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${size === key ? "bg-accent text-white border-accent" : "bg-card border-border/50 text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Theme</label>
          <div className="flex gap-1.5">
            {["dark", "light"].map(t => (
              <button key={t} onClick={() => setTheme(t)}
                className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all capitalize ${theme === t ? "bg-secondary text-white border-primary" : "bg-card border-border/50 text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Code block */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Embed Code</label>
        <div className="relative">
          <pre className="p-3 pr-10 rounded-lg bg-secondary/60 border border-border/50 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {iframeCode}
          </pre>
          <button onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border/50 hover:border-primary/40 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        </div>
        <button onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white font-display font-bold text-sm transition-all hover:bg-primary/90">
          {copied ? <><Check className="w-4 h-4" /> Embed code copied!</> : <><Copy className="w-4 h-4" /> Copy Embed Code</>}
        </button>
      </div>

      {/* Preview toggle */}
      <div className="space-y-2">
        <button onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <Monitor className="w-4 h-4" />
          <span className="text-sm">{showPreview ? "Hide Preview" : "Show Preview"}</span>
        </button>
        {showPreview && (
          <div className="rounded-xl overflow-hidden border border-border/50" style={{ height: SIZES[size].height }}>
            <iframe src={embedUrl} width="100%" height="100%" frameBorder="0" style={{ border: "none" }} title="Widget Preview" />
          </div>
        )}
      </div>

      {/* Direct link */}
      <a href={embedUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ExternalLink className="w-3.5 h-3.5" /> Open widget in new tab
      </a>
    </div>
  );
}