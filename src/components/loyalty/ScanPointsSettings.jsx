import { useState, useEffect } from "react";
import { Ticket, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Lets an organizer configure how many points a fan earns per validly scanned/attended event.
export default function ScanPointsSettings({ ownerId }) {
  const [value, setValue] = useState("");
  const [defaultPoints, setDefaultPoints] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      const [programs, rules] = await Promise.all([
        base44.entities.LoyaltyProgram.filter({ owner_type: "organizer", owner_id: ownerId }, "created_date", 1).catch(() => []),
        base44.entities.LoyaltyPointRule.list(null, 1).catch(() => []),
      ]);
      setDefaultPoints(rules[0]?.scan_points ?? 25);
      const program = programs[0];
      setValue(program?.scan_points ? String(program.scan_points) : "");
      setLoading(false);
    })();
  }, [ownerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("updateLoyaltyProgramSettings", {
        owner_type: "organizer",
        owner_id: ownerId,
        scan_points: value ? Number(value) : 0,
      });
      toast.success("Saved! This applies to all future ticket scans.");
    } catch (e) {
      toast.error("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Ticket className="w-3 h-3" /> Points Per Attended Event
      </p>
      <p className="text-sm text-muted-foreground">
        Fans automatically earn points when their ticket is validly scanned at one of your events. This adds to their same combined points balance.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs font-mono text-muted-foreground">Points per scan</Label>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={`Default: ${defaultPoints}`}
            className="mt-1 bg-secondary border-border/50"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 glow-lime font-display font-bold">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}