import { useState } from "react";
import { X, Search, ChevronRight, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRelativeTime } from "@/utils/getRelativeTime";

const BYTES_PER_GB = 1_073_741_824;
const CATEGORY_LABELS = {
  event_image: "Event Images", event_video: "Event Videos", flyer: "Flyers",
  ai_flyer: "AI Flyers", ai_flyer_upload: "AI Flyer Uploads",
  ai_flyer_generated_image: "AI Generated Images", ai_flyer_generated_video: "AI Generated Videos",
  media_library: "Media Library", video_360: "360 Videos",
  community: "Community", community_image: "Community Images", community_video: "Community Videos",
  other: "Other",
};

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / BYTES_PER_GB).toFixed(3)} GB`;
}
function fmtGb(gb) { return `${gb.toFixed(4)} GB`; }

// ── Per-user file detail view ─────────────────────────────────────────────
function UserDetail({ user, onBack }) {
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = user.records.filter(r => {
    if (catFilter !== "all" && r.file_category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (r.file_url || "").split("/").pop().toLowerCase();
      if (!name.includes(q) && !(r.file_category || "").includes(q)) return false;
    }
    return true;
  });

  const cats = {};
  user.records.forEach(r => {
    const c = r.file_category || "other";
    if (!cats[c]) cats[c] = { count: 0, bytes: 0 };
    cats[c].count++;
    cats[c].bytes += r.file_size_bytes || 0;
  });

  const lastUpload = user.records
    .map(r => r.created_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="flex flex-col h-full">
      {/* User header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border/30">
        <button onClick={onBack} className="mt-0.5 p-1 rounded hover:bg-secondary/50 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-base leading-tight break-all">{user.name}</p>
          <p className="text-xs text-muted-foreground break-all mt-0.5">{user.email}</p>
          {lastUpload && (
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">
              Last upload: {getRelativeTime(lastUpload)}
            </p>
          )}
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-border/30">
        <div className="rounded-lg bg-secondary/40 p-2 text-center">
          <p className="text-[9px] font-mono text-muted-foreground">Files</p>
          <p className="font-display font-black text-base">{user.records.length}</p>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2 text-center">
          <p className="text-[9px] font-mono text-muted-foreground">Total Size</p>
          <p className="font-display font-black text-base text-accent">{fmtBytes(user.bytes)}</p>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2 text-center">
          <p className="text-[9px] font-mono text-muted-foreground">Categories</p>
          <p className="font-display font-black text-base text-primary">{Object.keys(cats).length}</p>
        </div>
      </div>

      {/* Category pills */}
      {Object.keys(cats).length > 0 && (
        <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-border/20">
          <button
            onClick={() => setCatFilter("all")}
            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold transition-colors ${catFilter === "all" ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary/40 text-muted-foreground border border-border/20 hover:border-border/50"}`}
          >
            All ({user.records.length})
          </button>
          {Object.entries(cats).map(([cat, d]) => (
            <button
              key={cat}
              onClick={() => setCatFilter(catFilter === cat ? "all" : cat)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold transition-colors ${catFilter === cat ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary/40 text-muted-foreground border border-border/20 hover:border-border/50"}`}
            >
              {CATEGORY_LABELS[cat] || cat} ({d.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-5 py-3 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/50 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono text-center py-8">No files found.</p>
        ) : (
          <>
            {filtered.slice(0, 200).map(r => {
              const fileName = (r.file_url || "").split("/").pop() || "unknown";
              return (
                <div key={r.id} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-border/20 hover:border-border/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-foreground truncate" title={fileName}>{fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {CATEGORY_LABELS[r.file_category] || r.file_category || "other"}
                      </span>
                      {r.month_key && <span className="text-[9px] font-mono text-muted-foreground/50">{r.month_key}</span>}
                      {r.created_date && (
                        <span className="text-[9px] font-mono text-muted-foreground/50">
                          {getRelativeTime(r.created_date)}
                        </span>
                      )}
                      {r.event_id && (
                        <span className="text-[9px] font-mono text-accent/70">Event linked</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-accent">{fmtBytes(r.file_size_bytes)}</span>
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length > 200 && (
              <p className="text-[9px] text-muted-foreground font-mono text-center pt-2">+{filtered.length - 200} more files</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Users list view (default) ─────────────────────────────────────────────
function UsersListView({ userList, freeGb, pricePerGb, billingEnabled, onSelectUser }) {
  const [search, setSearch] = useState("");

  const filtered = userList.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }).sort((a, b) => b.bytes - a.bytes);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/50 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono text-center py-8">No users found.</p>
        ) : filtered.map(user => {
          const userGb = user.bytes / BYTES_PER_GB;
          const extraGb = Math.max(0, userGb - freeGb);
          const estCharge = billingEnabled ? extraGb * pricePerGb : 0;
          const lastUpload = user.records.map(r => r.created_date).filter(Boolean).sort().at(-1);

          return (
            <button
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="w-full rounded-xl bg-secondary/20 border border-border/30 hover:border-primary/40 hover:bg-secondary/40 transition-all text-left p-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{user.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground break-all mt-0.5">{user.email}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground/70">{user.records.length} files</span>
                    {lastUpload && (
                      <span className="text-[9px] font-mono text-muted-foreground/70">
                        Last: {getRelativeTime(lastUpload)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right flex items-center gap-2">
                  <div>
                    <p className="text-xs font-mono font-bold text-accent">{fmtBytes(user.bytes)}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{fmtGb(userGb)}</p>
                    {billingEnabled && estCharge > 0 && (
                      <p className="text-[9px] font-mono text-yellow-400">~${estCharge.toFixed(2)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Category / breakdown view (files, size, gb cards) ─────────────────────
function BreakdownView({ type, allRecords, totalBytes, totalGb }) {
  const cats = {};
  allRecords.forEach(r => {
    const c = r.file_category || "other";
    if (!cats[c]) cats[c] = { count: 0, bytes: 0 };
    cats[c].count++;
    cats[c].bytes += r.file_size_bytes || 0;
  });
  const sorted = Object.entries(cats).sort((a, b) => b[1].bytes - a[1].bytes);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-secondary/40 p-3 text-center">
            <p className="text-[9px] font-mono text-muted-foreground">Total Files</p>
            <p className="font-display font-black text-xl">{allRecords.length}</p>
          </div>
          <div className="rounded-lg bg-secondary/40 p-3 text-center">
            <p className="text-[9px] font-mono text-muted-foreground">Total Size</p>
            <p className="font-display font-black text-xl text-accent">{fmtBytes(totalBytes)}</p>
          </div>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase font-bold mb-2">By Category</p>
        <div className="space-y-2">
          {sorted.map(([cat, d]) => {
            const pct = totalBytes > 0 ? (d.bytes / totalBytes) * 100 : 0;
            return (
              <div key={cat} className="rounded-lg bg-secondary/30 border border-border/20 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-mono font-bold">{CATEGORY_LABELS[cat] || cat}</p>
                  <div className="text-right">
                    <span className="text-xs font-mono text-accent">{fmtBytes(d.bytes)}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-2">{d.count} files</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground mt-1">{pct.toFixed(1)}% of total</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────
const TITLES = {
  files: "File Breakdown",
  size:  "Size Breakdown",
  gb:    "GB Breakdown",
  users: "User Storage Details",
};

export default function StorageUsersModal({ type, userList, allRecords, totalBytes, totalGb, freeGb, pricePerGb, billingEnabled, onClose }) {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border/40 rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl flex flex-col"
        style={{ height: "90dvh", maxHeight: "90dvh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 shrink-0">
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Admin Storage</p>
            <p className="font-display font-bold text-base mt-0.5">
              {selectedUser ? selectedUser.name : TITLES[type]}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {type === "users" ? (
            selectedUser ? (
              <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />
            ) : (
              <UsersListView
                userList={userList}
                freeGb={freeGb}
                pricePerGb={pricePerGb}
                billingEnabled={billingEnabled}
                onSelectUser={setSelectedUser}
              />
            )
          ) : (
            <div className="overflow-y-auto h-full">
              <BreakdownView type={type} allRecords={allRecords} totalBytes={totalBytes} totalGb={totalGb} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/30 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}