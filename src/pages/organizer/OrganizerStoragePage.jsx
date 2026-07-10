import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import OrganizerStorageWidget from "@/components/organizer/OrganizerStorageWidget";
import StreamingUsageWidget from "@/components/streaming/StreamingUsageWidget";
import { HardDrive, Play, ChevronDown, Upload } from "lucide-react";
import { getStorageSettings } from "@/lib/storageSettingsHelper";
import { base44 } from "@/api/base44Client";

export default function OrganizerStoragePage() {
  const [storagePrice, setStoragePrice] = useState(null);
  const [freeStreamingMinutes, setFreeStreamingMinutes] = useState(null);

  useEffect(() => {
    getStorageSettings().then(({ pricePerGb }) => setStoragePrice(pricePerGb)).catch(() => {});
    base44.functions.invoke("videoMinuteBilling", { action: "get_pricing" })
      .then(res => {
        const mins = res?.data?.free_minutes_per_user_monthly;
        if (mins != null) setFreeStreamingMinutes(mins);
      }).catch(() => {});
  }, []);

  const scrollToDetails = () => {
    document.getElementById("usage-details-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-6 mobile-bottom-nav-spacing">
      {/* Page heading */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">USAGE & STORAGE</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor and manage your streaming minutes and storage usage.</p>
      </div>

      {/* ── Top Management Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Manage Streaming */}
        <button
          onClick={() => document.getElementById("streaming-minutes-section")?.scrollIntoView({ behavior: "smooth" })}
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-primary/40 hover:border-primary transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Play className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-base text-primary">Manage Streaming</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">View usage, free minutes, and billing details</p>
          </div>
        </button>

        {/* Manage Storage */}
        <Link
          to="/organizer/gallery"
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-accent/40 hover:border-accent transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
            <Upload className="w-6 h-6 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-base text-accent">Manage Storage</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Upload, view, and manage your media files
              {storagePrice != null && (
                <span className="block text-[10px] font-mono mt-0.5 text-muted-foreground/70">
                  Overage: ${storagePrice.toFixed(2)}/GB
                </span>
              )}
            </p>
          </div>
        </Link>
      </div>

      {/* Scroll hint */}
      <button
        onClick={scrollToDetails}
        className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors mx-auto"
      >
        <ChevronDown className="w-4 h-4" />
        Scroll down for detailed instructions.
      </button>

      {/* ── Detailed usage sections ── */}
      <div id="usage-details-section" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Streaming Usage */}
        <div id="streaming-minutes-section">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-base uppercase tracking-wider text-primary">Streaming Minutes</h2>
          </div>
          <StreamingUsageWidget />
        </div>

        {/* Storage Usage */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-base uppercase tracking-wider text-primary">Media Storage</h2>
          </div>
          <OrganizerStorageWidget />
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-xl bg-card border border-primary/20 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-[10px] font-black">?</span>
          </div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">How Usage & Billing Works</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary shrink-0" />
              <p className="font-mono text-sm font-bold text-primary">Storage (GB)</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Used when you upload videos or media files. 10 GB is included for free.{" "}
              {storagePrice != null ? `Any additional GB is $${storagePrice.toFixed(2)} per GB.` : "Additional GB is billed per GB."}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-primary shrink-0" />
              <p className="font-mono text-sm font-bold text-primary">Streaming Minutes</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Used when fans watch or play your videos. {freeStreamingMinutes != null ? freeStreamingMinutes.toLocaleString() : "—"} free minutes included per month. After the free limit, usage is billed at $0.0016 per minute.
            </p>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-green-400/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-green-400 text-[8px] font-black">✓</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">You are NOT double charged.</span> Storage and streaming are separate usage types — both are needed to keep your videos available and playable.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-green-400/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-green-400 text-[8px] font-black">✓</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">Free limits are included</span> for both storage and streaming. You only pay when you exceed them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}