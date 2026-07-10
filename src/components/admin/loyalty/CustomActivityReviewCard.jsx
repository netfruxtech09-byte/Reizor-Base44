import { useState } from "react";
import { CheckCircle2, XCircle, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CustomActivityReviewCard({ activity, onChanged }) {
  const [approvedPoints, setApprovedPoints] = useState(activity.approved_points || activity.proposed_points);
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      await base44.functions.invoke("reviewCustomEarningActivity", {
        activity_id: activity.id, action,
        approved_points: action === "approve" ? Number(approvedPoints) : undefined,
      });
      toast.success(`Activity ${action}d`);
      onChanged?.();
    } catch {
      toast.error("Action failed.");
    }
    setBusy(false);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-bold text-sm">{activity.activity_name}</p>
          <p className="text-xs text-muted-foreground">{activity.owner_type} — {activity.owner_name} ({activity.owner_email})</p>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">{activity.status}</span>
      </div>
      {activity.description && <p className="text-sm text-muted-foreground">{activity.description}</p>}
      <p className="text-xs font-mono text-muted-foreground">
        Verification: {activity.verification_method?.replace(/_/g, " ")} · Proposed: {activity.proposed_points} pts
        {activity.status === "approved" ? ` · Approved: ${activity.approved_points} pts` : ""}
      </p>

      {activity.status === "pending" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Input type="number" value={approvedPoints} onChange={e => setApprovedPoints(e.target.value)} className="w-28 bg-secondary border-border/50" />
          <Button size="sm" onClick={() => run("approve")} disabled={busy} className="gap-1.5 glow-lime font-display font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("reject")} disabled={busy} className="gap-1.5 border-destructive/40 text-destructive">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
        </div>
      )}
      {activity.status === "approved" && (
        <Button size="sm" variant="outline" onClick={() => run("deactivate")} disabled={busy} className="gap-1.5 border-destructive/40 text-destructive">
          <PauseCircle className="w-3.5 h-3.5" /> Deactivate
        </Button>
      )}
      {activity.status === "deactivated" && (
        <Button size="sm" variant="outline" onClick={() => run("reactivate")} disabled={busy} className="gap-1.5">
          <PlayCircle className="w-3.5 h-3.5" /> Reactivate
        </Button>
      )}
      {(activity.status === "rejected" || activity.status === "deactivated") && (
        <Button size="sm" variant="outline" onClick={() => run("delete")} disabled={busy} className="gap-1.5 border-destructive/40 text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      )}
    </div>
  );
}