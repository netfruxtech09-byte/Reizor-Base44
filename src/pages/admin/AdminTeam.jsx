import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Trash2, Edit2, ShieldCheck, Users } from "lucide-react";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';
import { toast } from "sonner";

const PERMISSIONS = [
  { key: "can_create_events", label: "Create Events" },
  { key: "can_edit_events", label: "Edit Events" },
  { key: "can_delete_events", label: "Delete Events" },
  { key: "can_view_events", label: "View Events" },
  { key: "can_upload_media", label: "Upload Media" },
  { key: "can_delete_media", label: "Delete Media" },
  { key: "can_manage_tickets", label: "Manage Tickets & Tiers" },
  { key: "can_manage_promos", label: "Manage Discounts & Promos" },
  { key: "can_view_orders", label: "View Orders" },
  { key: "can_view_analytics", label: "View Analytics" },
  { key: "can_scan_tickets", label: "Scan Tickets at Entry" },
];

const ROLE_PRESETS = {
  manager: {
    can_create_events: true, can_edit_events: true, can_delete_events: false,
    can_view_events: true, can_upload_media: true, can_delete_media: true,
    can_manage_tickets: true, can_manage_promos: true,
    can_view_orders: true, can_view_analytics: true, can_scan_tickets: true,
  },
  scanner: {
    can_create_events: false, can_edit_events: false, can_delete_events: false,
    can_view_events: true, can_upload_media: false, can_delete_media: false,
    can_manage_tickets: false, can_manage_promos: false,
    can_view_orders: false, can_view_analytics: false, can_scan_tickets: true,
  },
};

const ROLE_COLORS = {
  manager: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  scanner: "bg-accent/10 text-accent border-accent/30",
};

const emptyForm = () => ({
  user_email: "", user_name: "", role: "manager", notes: "", status: "active",
  ...ROLE_PRESETS.manager,
});

// Note: Organizers are NOT managed here — they should be invited via the Organizers section.

export default function AdminTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const loadingRef = useRef(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const saveAbortRef = useRef(false);

  useEffect(() => { load(); }, []);

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await base44.entities.Permission.list("-created_date", 100);
      setTeam(data);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  function openNew() {
    saveAbortRef.current = false;
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function handleCloseDialog() {
    saveAbortRef.current = true;
    setSaving(false);
    setOpen(false);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({ ...member });
    setOpen(true);
  }

  function applyPreset(role) {
    setForm((f) => ({ ...f, role, ...ROLE_PRESETS[role] }));
  }

  async function save() {
    if (!form.user_email) return toast.error("Email is required");
    saveAbortRef.current = false;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Permission.update(editing.id, form);
        if (saveAbortRef.current) return;
        toast.success("Permissions updated");
      } else {
        await base44.entities.Permission.create(form);
        if (saveAbortRef.current) return;
        const trimmedNote = (form.notes || "").trim();
        const subject = "You're invited to join Reizor";
        const body = buildEmailBody({
          title: "You're invited to Reizor 🎉",
          greeting: `Hi ${form.user_name || 'there'},`,
          message: `You've been invited to join <strong>Reizor</strong> as a <strong style="text-transform:capitalize;">${form.role}</strong>.`,
          infoBox: trimmedNote ? { rows: [{ label: 'Note', value: trimmedNote }] } : undefined,
          ctaText: 'Accept Invitation',
          ctaUrl: window.location.origin,
          footerNote: "We're excited to have you onboard!",
        });
        await sendEmail({ _source: 'AdminTeam/invite', to: form.user_email, subject, body });
        if (saveAbortRef.current) return;
        toast.success("Invitation sent");
      }
      setOpen(false);
      load();
    } catch (e) {
      if (!saveAbortRef.current) toast.error("Failed: " + e.message);
    }
    if (!saveAbortRef.current) setSaving(false);
  }

  async function remove(member) {
    if (!confirm(`Remove ${member.user_email} from the team?`)) return;
    await base44.entities.Permission.delete(member.id);
    toast.success("Team member removed");
    load();
  }

  async function toggleStatus(member) {
    const newStatus = member.status === "active" ? "suspended" : "active";
    await base44.entities.Permission.update(member.id, { status: newStatus });
    toast.success(`Member ${newStatus}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight">TEAM MANAGEMENT</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage admin team members (managers & scanners). To invite organizers, use the <strong>Organizers</strong> section.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Users className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">No team members yet. Invite your first manager or organizer.</p>
          <Button onClick={openNew} variant="outline" className="gap-2">
            <UserPlus className="w-4 h-4" /> Invite Someone
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {team.map((member) => (
            <div key={member.id} className="p-4 sm:p-5 rounded-lg bg-card border border-border/50 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold font-display text-lg shrink-0">
                    {(member.user_name || member.user_email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{member.user_name || "—"}</p>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 ${ROLE_COLORS[member.role] || ""}`}>
                        {member.role}
                      </span>
                      {member.status === "suspended" && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest bg-destructive/10 text-destructive border-destructive/30 shrink-0">
                          SUSPENDED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono truncate">{member.user_email}</p>
                    {member.notes && <p className="text-xs text-muted-foreground mt-1">{member.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(member)}>
                    <ShieldCheck className={`w-4 h-4 ${member.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(member)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSIONS.map((p) => (
                  <span key={p.key} className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${member[p.key] ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/40 text-muted-foreground border-border/30 line-through"}`}>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDialog(); }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl tracking-tight">
              {editing ? "EDIT PERMISSIONS" : "INVITE TEAM MEMBER"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input placeholder="email@example.com" value={form.user_email}
                  onChange={(e) => setForm((f) => ({ ...f, user_email: e.target.value }))}
                  disabled={!!editing} className="bg-background border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="Jane Doe" value={form.user_name}
                  onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))}
                  className="bg-background border-border/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                {["manager", "scanner"].map((r) => (
                  <button key={r} onClick={() => applyPreset(r)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold font-display uppercase tracking-wide transition-all ${form.role === r ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border/50 text-muted-foreground hover:border-primary/50"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Selecting a role applies a preset — you can customize below.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-bold">Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-background border border-border/50">
                {PERMISSIONS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={p.key} className="text-sm cursor-pointer">{p.label}</Label>
                    <Switch id={p.key} checked={!!form[p.key]}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="e.g. Door vendor for Spring events" value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-background border-border/50" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="flex-1 glow-lime" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Permissions" : "Invite & Save"}
              </Button>
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}