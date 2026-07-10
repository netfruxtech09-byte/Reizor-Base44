import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const ACTION_LABELS = {
  freeze_account: "Froze account",
  unfreeze_account: "Unfroze account",
  reverse_points: "Reversed points",
  deactivate_program: "Deactivated program",
  reactivate_program: "Reactivated program",
  deactivate_tier: "Deactivated tier",
  reactivate_tier: "Reactivated tier",
};

export default function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AdminLoyaltyAuditLog.list("-created_date", 200).then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No admin loyalty actions recorded yet.</p>
      ) : logs.map(log => (
        <div key={log.id} className="p-3 rounded-lg bg-card border border-border/40 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0">
            <ClipboardList className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-sm">{ACTION_LABELS[log.action] || log.action}</p>
              {log.target_summary && <p className="text-xs text-muted-foreground truncate">{log.target_summary}</p>}
              {log.reason && <p className="text-xs text-muted-foreground italic mt-0.5">Reason: {log.reason}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono text-muted-foreground">{log.admin_name || log.admin_email}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              {log.created_date ? format(new Date(log.created_date), "MMM d, yyyy h:mm a") : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}