import { useState, useEffect } from "react";
import { HardDrive, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getStorageSettings } from "@/lib/storageSettingsHelper";

const BYTES_PER_GB = 1024 * 1024 * 1024;

function fmt(bytes) {
  if (!bytes || bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

export default function OrganizerStorageWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      const admin = u?.role === "admin";
      setIsAdmin(admin);

      const records = await base44.entities.OrganizerStorageRecord.filter({ organizer_id: u.id, deleted: false }).catch(() => []);
      const { freeGb: freeGB, pricePerGb: ratePerGB } = await getStorageSettings();

      const totalBytes = records.reduce((s, r) => s + (r.file_size_bytes || 0), 0);
      const totalGB = totalBytes / BYTES_PER_GB;
      const extraGB = admin ? 0 : Math.max(0, totalGB - freeGB);
      const estimatedCharge = extraGB * ratePerGB;
      const remainingBytes = admin ? null : Math.max(0, freeGB * BYTES_PER_GB - totalBytes);
      const fileCount = records.length;

      setData({ totalBytes, totalGB, freeGB, ratePerGB, extraGB, estimatedCharge, remainingBytes, fileCount });
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="rounded-xl bg-card border border-border/40 p-4 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  const pct = isAdmin
    ? 100
    : data.freeGB > 0 ? Math.min(100, (data.totalGB / data.freeGB) * 100) : 0;
  const isOver = !isAdmin && data.extraGB > 0;

  const statusColor = isAdmin
    ? "bg-accent/10 border-accent/30"
    : isOver ? "bg-destructive/10 border-destructive/30"
    : pct >= 80 ? "bg-yellow-400/10 border-yellow-400/30"
    : "bg-green-500/10 border-green-500/30";

  const statusIcon = isAdmin
    ? <HardDrive className="w-4 h-4 text-accent shrink-0 mt-0.5" />
    : isOver
      ? <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      : pct >= 80
        ? <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;

  const statusTitle = isAdmin ? "Admin Usage Tracking"
    : isOver ? "Over Limit"
    : pct >= 80 ? "Approaching Limit"
    : "Within Limit";

  return (
    <div className="space-y-4">
      {/* Summary card — same structure as StreamingUsageSummary */}
      <div className="rounded-lg bg-[#1a1d26] border border-border/30 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <p className="text-xs font-mono text-muted-foreground">Free Limit</p>
          <p className="text-xs font-mono text-muted-foreground">Used</p>
          <p className="text-xs font-mono text-muted-foreground">Remaining</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <p className="font-display font-black text-sm text-foreground">
            {isAdmin ? "Unlimited" : `${data.freeGB} GB`}
          </p>
          <p className="font-display font-black text-sm text-foreground">
            {fmt(data.totalBytes)}
          </p>
          <p className={`font-display font-black text-sm ${
            isAdmin ? "text-accent" : isOver ? "text-destructive" : "text-green-400"
          }`}>
            {isAdmin ? "—" : fmt(data.remainingBytes)}
          </p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAdmin ? "bg-accent"
              : pct >= 100 ? "bg-destructive"
              : pct >= 80 ? "bg-yellow-400"
              : "bg-green-400"
            }`}
            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
          />
        </div>
      </div>

      {/* Status message */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${statusColor}`}>
        {statusIcon}
        <div>
          <p className="font-mono text-xs font-bold uppercase">{statusTitle}</p>
          {isAdmin ? (
            <p className="text-xs text-accent mt-1">
              Tracking only — no limits · {data.fileCount} file{data.fileCount !== 1 ? "s" : ""} · est. rate ${data.ratePerGB.toFixed(2)}/GB
            </p>
          ) : isOver ? (
            <p className="text-xs text-destructive mt-1">
              {data.extraGB.toFixed(2)} GB over your free limit · est. ${data.estimatedCharge.toFixed(2)} deducted from next payout at ${data.ratePerGB.toFixed(2)}/GB · {data.fileCount} file{data.fileCount !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs text-green-400 mt-1">
              {fmt(data.totalBytes)} used of {data.freeGB} GB · {fmt(data.remainingBytes)} remaining · {data.fileCount} file{data.fileCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}