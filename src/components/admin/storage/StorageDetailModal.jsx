import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const BYTES_PER_GB = 1_073_741_824;
const CATEGORY_LABELS = {
  event_image: "Event Images",
  event_video: "Event Videos",
  flyer: "Flyers",
  ai_flyer: "AI Flyers (legacy)",
  ai_flyer_upload: "AI Flyer Uploads",
  ai_flyer_generated_image: "AI Generated Images",
  ai_flyer_generated_video: "AI Generated Videos",
  media_library: "Media Library",
  video_360: "360 Videos",
  community: "Community Posts (legacy)",
  community_image: "Community Images",
  community_video: "Community Videos",
  other: "Other",
};

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / BYTES_PER_GB).toFixed(3)} GB`;
}

export default function StorageDetailModal({ user, records, userType, onClose }) {
  const [filterCategory, setFilterCategory] = useState("all");

  if (!user || !records) return null;

  const filtered = filterCategory === "all" ? records : records.filter(r => r.file_category === filterCategory);
  const totalBytes = filtered.reduce((s, r) => s + (r.file_size_bytes || 0), 0);

  // Category breakdown
  const cats = {};
  records.forEach(r => {
    const c = r.file_category || "other";
    if (!cats[c]) cats[c] = { count: 0, bytes: 0 };
    cats[c].count++;
    cats[c].bytes += r.file_size_bytes || 0;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border/40 rounded-xl max-w-2xl w-full my-8">
        {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 border-b border-border/30">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold uppercase text-muted-foreground mb-1">
                {userType === "organizer" ? "Organizer" : userType === "artist" ? "Artist" : "White Label"} Storage
              </p>
             <p className="font-display font-bold text-lg sm:text-xl truncate">{user.name}</p>
             <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
           </div>
           <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
             <X className="w-5 h-5" />
           </button>
         </div>

        {/* Stats */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg bg-secondary/40 p-3 text-center">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">Total Files</p>
            <p className="font-display font-black text-lg">{records.length}</p>
          </div>
          <div className="rounded-lg bg-secondary/40 p-3 text-center">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">Total Size</p>
            <p className="font-display font-black text-lg text-accent">{fmtBytes(records.reduce((s, r) => s + (r.file_size_bytes || 0), 0))}</p>
          </div>
          <div className="rounded-lg bg-secondary/40 p-3 text-center">
            <p className="text-[10px] font-mono text-muted-foreground mb-1">Categories</p>
            <p className="font-display font-black text-lg text-primary">{Object.keys(cats).length}</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
          <p className="font-mono text-xs font-bold text-muted-foreground uppercase mb-3">Category Breakdown</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(cats).map(([cat, data]) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                className={`rounded-lg p-2 text-center text-xs transition-all cursor-pointer ${
                  filterCategory === cat
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-secondary/40 border border-border/20 hover:border-border/40"
                }`}
              >
                <p className="font-mono text-[9px] text-muted-foreground truncate">{CATEGORY_LABELS[cat] || cat}</p>
                <p className="font-bold text-sm mt-0.5">{data.count}</p>
                <p className="font-mono text-[9px] text-accent">{fmtBytes(data.bytes)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Files list */}
        <div className="px-4 sm:px-6 py-4 border-t border-border/30">
          <p className="font-mono text-xs font-bold text-muted-foreground uppercase mb-3">Files ({filtered.length})</p>
          <div className="space-y-1 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono text-center py-4">No files in this category.</p>
            ) : (
              filtered.slice(0, 100).map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 py-2 px-2 rounded border border-border/20 hover:border-border/40 transition-colors text-[10px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate font-mono">{r.file_url?.split("/").pop() || "unknown"}</p>
                    <p className="text-muted-foreground text-[9px] mt-0.5">
                      {r.month_key} · {CATEGORY_LABELS[r.file_category] || r.file_category}
                    </p>
                  </div>
                  <span className="text-accent font-mono font-bold shrink-0">{fmtBytes(r.file_size_bytes)}</span>
                </div>
              ))
            )}
            {filtered.length > 100 && (
              <p className="text-[9px] text-muted-foreground font-mono text-center pt-2">+{filtered.length - 100} more files</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-border/30 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}