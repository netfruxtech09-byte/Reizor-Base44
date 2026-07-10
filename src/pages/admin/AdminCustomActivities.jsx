import { useState, useEffect } from "react";
import { ClipboardList, Inbox } from "lucide-react";
import CustomActivityReviewCard from "@/components/admin/loyalty/CustomActivityReviewCard";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "deactivated", label: "Deactivated" },
];

export default function AdminCustomActivities() {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { base44 } = await import("@/api/base44Client");
    const data = await base44.entities.CustomEarningActivity.filter({ status: filter }, "-created_date", 200).catch(() => []);
    setActivities(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const EMPTY_HINT = {
    pending: "When an Organizer or Artist submits a custom earning activity from their Loyalty Program page, it will appear here for your review. Points cannot be awarded until you approve it.",
    approved: "No approved custom activities yet. Approved activities can award points to fans and are eligible for the loyalty program.",
    rejected: "No rejected activities.",
    deactivated: "No deactivated activities.",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-primary" /> CUSTOM EARNING ACTIVITIES
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve custom loyalty-earning activities requested by Organizers and Artists. Standard actions (like, comment, scan, etc.) earn points automatically — this queue is only for custom activities they define themselves.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/30"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : activities.length === 0 ? (
        <div className="py-10 px-6 text-center rounded-xl border border-dashed border-border/50 bg-card/30">
          <Inbox className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-display font-bold text-sm">No {filter} activities</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">{EMPTY_HINT[filter]}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(a => <CustomActivityReviewCard key={a.id} activity={a} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}