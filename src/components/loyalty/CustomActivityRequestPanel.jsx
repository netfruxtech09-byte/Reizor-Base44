import { useState, useEffect } from "react";
import { Plus, Send, Clock, CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const VERIFICATION_METHODS = [
  { value: "qr_scan", label: "QR Scan / Check-in" },
  { value: "staff_approval", label: "Organizer/Artist Staff Approval" },
  { value: "admin_approval", label: "Admin Approval" },
  { value: "verified_attendance", label: "Verified Ticket / Attendance" },
  { value: "automatic_system", label: "Automatic System Event" },
];

const STATUS_CFG = {
  pending: { label: "Pending Admin Review", cls: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  approved: { label: "Approved", cls: "text-green-400 bg-green-400/10", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "text-destructive bg-destructive/10", icon: XCircle },
  deactivated: { label: "Deactivated", cls: "text-muted-foreground bg-muted", icon: PauseCircle },
};

const BLANK = { activity_name: "", description: "", proposed_points: "", verification_method: "staff_approval" };

export default function CustomActivityRequestPanel({ ownerType, ownerId, ownerName, ownerEmail }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    base44.entities.CustomEarningActivity.filter({ owner_type: ownerType, owner_id: ownerId }, "-created_date", 100)
      .then(setActivities).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [ownerType, ownerId]);

  const handleSubmit = async () => {
    if (!form.activity_name.trim() || !form.proposed_points) {
      toast.error("Activity name and proposed points are required.");
      return;
    }
    setSubmitting(true);
    await base44.entities.CustomEarningActivity.create({
      owner_type: ownerType, owner_id: ownerId, owner_name: ownerName, owner_email: ownerEmail,
      activity_name: form.activity_name, description: form.description,
      proposed_points: Number(form.proposed_points), verification_method: form.verification_method,
      status: "pending",
    });
    toast.success("Submitted for Admin review. Points cannot be awarded until approved.");
    setForm(BLANK);
    load();
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
        <p className="font-display font-bold text-sm">Request a Custom Earning Activity</p>
        <p className="text-xs text-muted-foreground">
          Standard actions (like, comment, review, scan, raffle, poll, share) already earn points automatically.
          Use this for anything else — e.g. a venue challenge or street-team activity. Admin must approve before any points can be awarded.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Activity Name *</Label>
            <Input value={form.activity_name} onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))} placeholder="e.g. Venue Challenge" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Proposed Points *</Label>
            <Input type="number" value={form.proposed_points} onChange={e => setForm(f => ({ ...f, proposed_points: e.target.value }))} placeholder="e.g. 15" className="mt-1 bg-secondary border-border/50" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Description</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what the fan must do" className="mt-1 bg-secondary border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Verification Method</Label>
          <Select value={form.verification_method} onValueChange={v => setForm(f => ({ ...f, verification_method: v }))}>
            <SelectTrigger className="mt-1 bg-secondary border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VERIFICATION_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="gap-2 glow-lime font-display font-bold">
          <Send className="w-3.5 h-3.5" /> {submitting ? "Submitting..." : "Submit for Admin Review"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Your Requests</p>
        {loading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No custom activities requested yet.</p>
        ) : (
          activities.map(a => {
            const cfg = STATUS_CFG[a.status] || STATUS_CFG.pending;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className="p-3 rounded-lg bg-card border border-border/40 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{a.activity_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    Proposed: {a.proposed_points} pts {a.status === "approved" ? `· Approved: ${a.approved_points} pts` : ""}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded-full ${cfg.cls}`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}