import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getStorageSettings } from "@/lib/storageSettingsHelper";
import { HardDrive, AlertTriangle, CheckCircle2 } from "lucide-react";

const BYTES_PER_GB = 1_073_741_824;

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / BYTES_PER_GB).toFixed(3)} GB`;
}

export default function StorageUsageSummary({ userEmail, userType, isAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const records = await base44.entities.OrganizerStorageRecord
        .filter({ organizer_email: userEmail }, null, 1000)
        .catch(() => []);

      const { freeGb, pricePerGb, billingEnabled } = await getStorageSettings();

      const totalBytes = records.reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);
      const totalGb = totalBytes / BYTES_PER_GB;
      const extraGb = isAdmin ? 0 : Math.max(0, totalGb - freeGb);
      const estimatedCharge = billingEnabled ? extraGb * pricePerGb : 0;
      const remainingGb = isAdmin ? null : Math.max(0, freeGb - totalGb);

      setData({
        totalFiles: records.length,
        totalBytes,
        totalGb,
        freeGb,
        pricePerGb,
        extraGb,
        estimatedCharge,
        remainingGb,
        isOverLimit: isAdmin ? false : extraGb > 0,
        billingEnabled,
      });
      setLoading(false);
    };

    if (userEmail) load();
  }, [userEmail]);

  if (loading) {
    return (
      <div className="rounded-xl bg-card border border-border/40 p-4 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const pct = isAdmin ? 100 : data.freeGb > 0 ? Math.min(100, (data.totalGb / data.freeGb) * 100) : 0;
  const isOver = data.isOverLimit;

  const statusColor = isAdmin
    ? "bg-accent/10 border-accent/30"
    : isOver ? "bg-destructive/10 border-destructive/30"
    : pct >= 80 ? "bg-yellow-400/10 border-yellow-400/30"
    : "bg-green-500/10 border-green-500/30";

  const statusIcon = isAdmin
    ? <HardDrive className="w-4 h-4 text-accent shrink-0 mt-0.5" />
    : isOver
      ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;

  const statusText = isAdmin ? "Admin Usage Tracking"
    : isOver ? "Over Limit"
    : pct >= 80 ? "Approaching Limit"
    : "Within Limit";

  return (
    <div className="space-y-4">
      {/* Unified 3-column card — matches StreamingUsageSummary */}
      <div className="rounded-lg bg-[#1a1d26] border border-border/30 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <p className="text-xs font-mono text-muted-foreground">Free Limit</p>
          <p className="text-xs font-mono text-muted-foreground">Used</p>
          <p className="text-xs font-mono text-muted-foreground">Remaining</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <p className="font-display font-black text-sm text-foreground">
            {isAdmin ? "Unlimited" : `${data.freeGb} GB`}
          </p>
          <p className="font-display font-black text-sm text-foreground">
            {fmtBytes(data.totalBytes)}
          </p>
          <p className={`font-display font-black text-sm ${
            isAdmin ? "text-accent" : isOver ? "text-destructive" : "text-green-400"
          }`}>
            {isAdmin ? "—" : fmtBytes(data.remainingGb * BYTES_PER_GB)}
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
          <p className="font-mono text-xs font-bold uppercase">{statusText}</p>
          {isAdmin ? (
            <p className="text-xs text-accent mt-1">
              Tracking only — no limits · {data.totalFiles} file{data.totalFiles !== 1 ? "s" : ""} · est. rate ${data.pricePerGb.toFixed(2)}/GB
            </p>
          ) : isOver ? (
            <p className="text-xs text-destructive mt-1">
              {fmtBytes(data.extraGb * BYTES_PER_GB)} over your free limit
              {data.billingEnabled && data.estimatedCharge > 0 && ` · est. $${data.estimatedCharge.toFixed(2)} overage at $${data.pricePerGb.toFixed(2)}/GB`}
            </p>
          ) : (
            <p className="text-xs text-green-400 mt-1">
              {fmtBytes(data.totalBytes)} used of {data.freeGb} GB · {fmtBytes(data.remainingGb * BYTES_PER_GB)} remaining · {data.totalFiles} file{data.totalFiles !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Pricing note */}
      <p className="text-[10px] font-mono text-muted-foreground">
        {isAdmin
          ? `Admin tracking only · Overage rate: $${data.pricePerGb.toFixed(2)}/GB (not charged to admin)`
          : `Any additional GB is $${data.pricePerGb.toFixed(2)} per GB.`
        }
      </p>
    </div>
  );
}