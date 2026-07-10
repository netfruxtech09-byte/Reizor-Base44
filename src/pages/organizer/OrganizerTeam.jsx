import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Trash2, Edit2, ShieldCheck, Users, Mail, Clock, Copy, Link as LinkIcon } from "lucide-react";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';
import { toast } from "sonner";
import StaffActivityLog from "../../components/organizer/StaffActivityLog";
import InviteLinkGenerator from "../../components/shared/InviteLinkGenerator";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const PERMISSIONS = [
  { key: "can_create_events", label: "Create Events" },
  { key: "can_edit_events", label: "Edit Events" },
  { key: "can_delete_events", label: "Delete Events" },
  { key: "can_view_events", label: "View Events" },
  { key: "can_upload_media", label: "Upload Media" },
  { key: "can_delete_media", label: "Delete Media" },
  { key: "can_manage_tickets", label: "Manage Tickets & Tiers" },
  { key: "can_manage_promos", label: "Manage Promos & Discounts" },
  { key: "can_view_orders", label: "View Orders" },
  { key: "can_view_analytics", label: "View Analytics" },
  { key: "can_scan_tickets", label: "Scan Tickets at Entry" },
];

// Organizer-side team roles
const TEAM_ROLES = {
  co_organizer: {
    label: "Co-Organizer",
    color: "bg-primary/10 text-primary border-primary/30",
    preset: {
      can_create_events: true, can_edit_events: true, can_delete_events: true,
      can_view_events: true, can_upload_media: true, can_delete_media: true,
      can_manage_tickets: true, can_manage_promos: true,
      can_view_orders: true, can_view_analytics: true, can_scan_tickets: true,
    },
  },
  event_manager: {
    label: "Event Manager",
    color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
    preset: {
      can_create_events: true, can_edit_events: true, can_delete_events: false,
      can_view_events: true, can_upload_media: true, can_delete_media: false,
      can_manage_tickets: true, can_manage_promos: true,
      can_view_orders: true, can_view_analytics: true, can_scan_tickets: true,
    },
  },
  finance: {
    label: "Finance / Reports",
    color: "bg-green-400/10 text-green-400 border-green-400/30",
    preset: {
      can_create_events: false, can_edit_events: false, can_delete_events: false,
      can_view_events: true, can_upload_media: false, can_delete_media: false,
      can_manage_tickets: false, can_manage_promos: false,
      can_view_orders: true, can_view_analytics: true, can_scan_tickets: false,
    },
  },
  scanner: {
    label: "Scanner / Door Staff",
    color: "bg-blue-400/10 text-blue-400 border-blue-400/30",
    preset: {
      can_create_events: false, can_edit_events: false, can_delete_events: false,
      can_view_events: true, can_upload_media: false, can_delete_media: false,
      can_manage_tickets: false, can_manage_promos: false,
      can_view_orders: false, can_view_analytics: false, can_scan_tickets: true,
    },
  },
};

const emptyForm = (organizerId) => ({
  user_email: "",
  user_name: "",
  role: "scanner",
  notes: `Invited by organizer: ${organizerId}`,
  status: "active",
  ...TEAM_ROLES.scanner.preset,
});

export default function OrganizerTeam() {
   const [team, setTeam] = useState([]);
   const [loading, setLoading] = useState(true);
   const [user, setUser] = useState(null);
   const [open, setOpen] = useState(false);
   const [editing, setEditing] = useState(null);
   const [form, setForm] = useState(null);
   const [saving, setSaving] = useState(false);
   const [resending, setResending] = useState(null); // member id being resent
   const [confirmRemove, setConfirmRemove] = useState(null); // member to remove
   const [formError, setFormError] = useState(null); // error message in modal
   const [inviteLink, setInviteLink] = useState(null); // generated invite link
   const [copyingLink, setCopyingLink] = useState(false);
   const loadingRef = useRef(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      load(u.id);
    });
  }, []);

  async function load(organizerId) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const all = await base44.entities.Permission.list("-created_date", 200);
      // Filter to only permissions created/managed by this organizer
      const mine = all.filter(p => p.notes?.includes(`Invited by organizer: ${organizerId}`));
      setTeam(mine);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm(user.id));
    setFormError(null);
    setOpen(true);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({ ...member });
    setFormError(null);
    setOpen(true);
  }

  function applyPreset(roleKey) {
    setForm(f => ({ ...f, role: roleKey, ...TEAM_ROLES[roleKey].preset }));
  }

  function generateInviteLink(member, roleMeta) {
    // Encode role and permissions in the invite link
    const permissionsStr = PERMISSIONS
      .filter(p => member[p.key])
      .map(p => p.key)
      .join(',');
    const encodedData = btoa(JSON.stringify({
      organizer_id: user.id,
      organizer_email: user.email,
      organizer_name: user.full_name || user.email,
      role: member.role,
      permissions: permissionsStr,
      invited_email: member.user_email,
      invited_name: member.user_name,
      created_at: new Date().toISOString(),
    }));
    // Use https://reizor.com for the invite link
    return `https://reizor.com/team-invite?code=${encodedData}`;
  }

  async function sendInviteEmail(member, roleMeta, noteText) {
    const inviteUrl = generateInviteLink(member, roleMeta);
    const subject = `You've been added to ${user.full_name || "an organizer"}'s team on Reizor`;
    const body = buildEmailBody({
      title: "You've been added to a team! 🎉",
      greeting: `Hi ${member.user_name || 'there'},`,
      message: `<strong>${user.full_name || user.email}</strong> has added you to their team on <strong>Reizor</strong> as a <strong>${roleMeta?.label || member.role}</strong>.<br/><br/>Please log in or sign up using this email address to access your assigned permissions.`,
      infoBox: {
        highlight: true,
        rows: [
          { label: "Organizer", value: user.full_name || user.email },
          { label: "Your Role", value: roleMeta?.label || member.role },
          ...(noteText ? [{ label: "Note", value: noteText }] : []),
        ],
      },
      ctaText: "Accept Invitation & Set Permissions",
      ctaUrl: inviteUrl,
      footerNote: "Click the button above to accept your invitation. If you don't have an account, you'll be prompted to sign up with this email address.",
    });
    // Use backend emailService function for better error handling
    const response = await base44.functions.invoke('emailService', {
      _source: "OrganizerTeam/invite",
      to: member.user_email,
      subject,
      body,
    });
    if (!response.data || response.data.error) {
      throw new Error(response.data?.error || "Failed to send invitation email");
    }
  }

  function copyInviteLink(link) {
    navigator.clipboard.writeText(link);
    setCopyingLink(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopyingLink(false), 2000);
  }

  async function save() {
    if (!form.user_email) {
      setFormError("Email is required");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const noteText = form.notes?.replace(`Invited by organizer: ${user.id}`, "").trim() || "";
      const roleMeta = TEAM_ROLES[form.role];

      if (editing) {
        await base44.entities.Permission.update(editing.id, form);
        toast.success("Permissions updated");
        setOpen(false);
        load(user.id);
      } else {
        // Prevent duplicate: check if same organizer already has this email
        const existing = team.find(m => m.user_email.toLowerCase() === form.user_email.toLowerCase());
        if (existing) {
          setFormError("This email is already on your team. Edit their permissions instead.");
          setSaving(false);
          return;
        }

        // Generate invite link FIRST with the selected permissions
        const link = generateInviteLink(form, roleMeta);
        setInviteLink(link);

        // Send email with the link
        try {
          await sendInviteEmail({ ...form }, roleMeta, noteText);
        } catch (emailError) {
          // Email failed — still show the link so they can copy/share it manually
          setFormError("Email could not be sent, but you can copy the invite link below and share it manually.");
          // Don't return early — still save the record with the link
        }

        // Save the record with the invite link
        await base44.entities.Permission.create({
          ...form,
          notes: `Invited by organizer: ${user.id}${noteText ? " " + noteText : ""}`,
          invite_link: link,
        });

        // Show success message (even if email failed, user has the link)
        if (!form.user_email) {
          toast.success("Team member invited! Share the invite link below.");
        } else {
          toast.success("Team member invited & email sent successfully!");
        }
        // Keep modal open to show the invite link for copying
        setSaving(false);
      }
    } catch (e) {
      setFormError("Failed to save permissions. Please try again.");
    }
    setSaving(false);
  }

  async function resendInvite(member) {
    setResending(member.id);
    try {
      const roleMeta = TEAM_ROLES[member.role];
      const noteText = member.notes?.replace(`Invited by organizer: ${user.id}`, "").trim() || "";
      await sendInviteEmail(member, roleMeta, noteText);
      toast.success("Invitation email resent!");
    } catch (e) {
      toast.error("Failed to resend: " + e.message);
    }
    setResending(null);
  }

  async function remove(member) {
    await base44.entities.Permission.delete(member.id);
    // Send removal notification email
    try {
      const body = buildEmailBody({
        title: "Team Access Removed",
        greeting: `Hi ${member.user_name || "there"},`,
        message: `You have been removed from <strong>${user.full_name || user.email}</strong>'s team on Reizor. Your account remains active as a fan account — you can still log in and use the platform normally.`,
        footerNote: "If you believe this was a mistake, please contact the organizer directly.",
      });
      await sendEmail({
        _source: "OrganizerTeam/remove",
        to: member.user_email,
        subject: `You've been removed from ${user.full_name || "an organizer"}'s team on Reizor`,
        body,
      });
    } catch (_) {
      // Non-critical — don't fail the removal if email fails
    }
    toast.success("Team member access has been removed successfully.");
    setConfirmRemove(null);
    load(user.id);
  }

  async function toggleStatus(member) {
    const newStatus = member.status === "active" ? "suspended" : "active";
    await base44.entities.Permission.update(member.id, { status: newStatus });
    toast.success(`Member ${newStatus}`);
    load(user.id);
  }

  if (loading || !user) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight">TEAM & PERMISSIONS</h1>
          <p className="text-muted-foreground text-sm mt-1">Invite team members and control exactly what they can access</p>
        </div>
        {team.length > 0 && (
          <Button onClick={openNew} variant="outline" className="gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> Invite
          </Button>
        )}
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(TEAM_ROLES).map(([key, meta]) => (
          <div key={key} className={`p-3 rounded-lg border text-center ${meta.color}`}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest">{meta.label}</p>
          </div>
        ))}
      </div>

      {/* Team list */}
      {team.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Users className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">No team members yet. Invite your first member.</p>
          <Button onClick={openNew} variant="outline" className="gap-2">
            <UserPlus className="w-4 h-4" /> Add Member
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {team.map((member) => {
            const roleMeta = TEAM_ROLES[member.role];
            return (
              <div key={member.id} className="p-4 sm:p-5 rounded-lg bg-card border border-border/50 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold font-display text-lg shrink-0">
                      {(member.user_name || member.user_email || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold truncate">{member.user_name || "—"}</p>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 ${roleMeta?.color || "bg-muted text-muted-foreground border-border/50"}`}>
                          {roleMeta?.label || member.role}
                        </span>
                        {member.status === "suspended" && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest bg-destructive/10 text-destructive border-destructive/30 shrink-0">
                            SUSPENDED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono truncate">{member.user_email}</p>
                      {member.created_date && (
                        <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> Added {new Date(member.created_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => resendInvite(member)} title="Resend invitation email" disabled={resending === member.id}>
                      <Mail className={`w-4 h-4 ${resending === member.id ? "animate-pulse text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(member)} title={member.status === "active" ? "Suspend" : "Reactivate"}>
                      <ShieldCheck className={`w-4 h-4 ${member.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmRemove(member)}>
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
            );
          })}
        </div>
      )}

      {/* Invite Links */}
      <div className="p-5 rounded-xl bg-card border border-border/50">
        <InviteLinkGenerator
          currentUser={user}
          allowedRoles={["user", "manager", "vendor"]}
        />
      </div>

      {/* Scan Activity */}
      {team.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold">Scan Activity</h2>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <StaffActivityLog organizerId={user.id} />
          </div>
        </div>
      )}

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(v) => { if (!v) setConfirmRemove(null); }}
        title={`Remove ${confirmRemove?.user_name || confirmRemove?.user_email}?`}
        description={`This will remove their team access. Their account will remain active as a normal fan account. A notification email will be sent to them.`}
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={() => remove(confirmRemove)}
      />

      {/* Invite / Edit Dialog */}
      {form && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display font-black text-xl tracking-tight">
                {editing ? "EDIT PERMISSIONS" : "INVITE TEAM MEMBER"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs text-muted-foreground font-mono leading-relaxed">
                📧 An invitation email will be sent to the team member. If they already have a Reizor account, they'll see their permissions on next login. If not, they should sign up with the same email address.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input placeholder="email@example.com" value={form.user_email}
                    onChange={(e) => setForm(f => ({ ...f, user_email: e.target.value }))}
                    disabled={!!editing} className="bg-background border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input placeholder="Jane Doe" value={form.user_name}
                    onChange={(e) => setForm(f => ({ ...f, user_name: e.target.value }))}
                    className="bg-background border-border/50" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role (applies a permission preset)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(TEAM_ROLES).map(([key, meta]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold font-display uppercase tracking-wide transition-all text-center ${form.role === key ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border/50 text-muted-foreground hover:border-primary/50"}`}>
                      {meta.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Selecting a role applies a preset — customize permissions below.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-bold">Permissions</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-background border border-border/50">
                  {PERMISSIONS.map((p) => (
                    <div key={p.key} className="flex items-center justify-between gap-3">
                      <Label htmlFor={p.key} className="text-sm cursor-pointer">{p.label}</Label>
                      <Switch id={p.key} checked={!!form[p.key]}
                        onCheckedChange={(v) => setForm(f => ({ ...f, [p.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes (optional — included in invite email)</Label>
                <Input placeholder="e.g. You're managing the main stage on Friday night"
                  value={form.notes?.replace(`Invited by organizer: ${user.id}`, '').trim() || ''}
                  onChange={(e) => setForm(f => ({ ...f, notes: `Invited by organizer: ${user.id} ${e.target.value}` }))}
                  className="bg-background border-border/50" />
              </div>

              {inviteLink && !editing && (
               <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
                 <div className="flex items-center gap-2">
                   <LinkIcon className="w-4 h-4 text-primary" />
                   <p className="text-xs font-bold text-primary">Invite Link Generated</p>
                 </div>
                 <div className="flex items-center gap-2">
                   <input type="text" readOnly value={inviteLink}
                     className="flex-1 bg-background border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground truncate" />
                   <Button size="icon" variant="outline" onClick={() => copyInviteLink(inviteLink)} disabled={copyingLink} className="shrink-0">
                     <Copy className="w-3 h-3" />
                   </Button>
                 </div>
                 <p className="text-[10px] text-muted-foreground">Copy this link and share it with the team member. It includes their role and permissions.</p>
               </div>
              )}

              {formError && (
               <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive font-mono leading-relaxed">
                 ⚠️ {formError}
               </div>
              )}
              <div className="flex gap-3 pt-2">
               {inviteLink && !editing ? (
                 <>
                   <Button className="flex-1 glow-lime" onClick={() => {
                     setOpen(false);
                     setInviteLink(null);
                     load(user.id);
                   }}>
                     Done
                   </Button>
                   <Button variant="outline" onClick={() => copyInviteLink(inviteLink)} className="gap-2">
                     <Copy className="w-3 h-3" /> Copy Link
                   </Button>
                 </>
               ) : (
                 <>
                   <Button className="flex-1 glow-lime" onClick={save} disabled={saving}>
                     {saving ? "Saving..." : editing ? "Update Permissions" : "Generate Invite Link"}
                   </Button>
                   <Button variant="outline" onClick={() => {
                     setOpen(false);
                     setInviteLink(null);
                   }}>Cancel</Button>
                 </>
               )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}