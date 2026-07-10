import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const FIELDS = [
  { key: "like_points", label: "Like" },
  { key: "comment_points", label: "Comment" },
  { key: "review_points", label: "Review" },
  { key: "scan_points", label: "Verified Ticket Scan / Attendance" },
  { key: "raffle_points", label: "Raffle Participation" },
  { key: "poll_points", label: "Poll Participation" },
  { key: "share_points", label: "Verified Share" },
];

export default function DefaultPointsPanel() {
  const [rule, setRule] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.LoyaltyPointRule.list(null, 1).then(res => {
      const r = res[0] || null;
      setRule(r);
      setValues(r || Object.fromEntries(FIELDS.map(f => [f.key, ""])));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(FIELDS.map(f => [f.key, Number(values[f.key]) || 0]));
    if (rule) {
      await base44.entities.LoyaltyPointRule.update(rule.id, payload);
    } else {
      const created = await base44.entities.LoyaltyPointRule.create(payload);
      setRule(created);
    }
    toast.success("Default point values saved. Applies platform-wide.");
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
      <p className="text-sm text-muted-foreground">
        These default point values apply to all active Organizer, Artist, and Platform loyalty programs unless an approved custom activity exists.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <div key={f.key}>
            <Label className="text-xs font-mono text-muted-foreground">{f.label}</Label>
            <Input type="number" value={values[f.key] ?? ""} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} className="mt-1 bg-secondary border-border/50" />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving} className="gap-2 glow-lime font-display font-bold">
        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Defaults"}
      </Button>
    </div>
  );
}