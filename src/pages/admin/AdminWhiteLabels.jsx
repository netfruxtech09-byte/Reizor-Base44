import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Globe, Check, X, LayoutDashboard, List, Send, Mail, Copy, Info, Search, Filter, ExternalLink, RefreshCw, Users, Clock, CheckCircle, AlertCircle, DollarSign, History } from "lucide-react";
import BulkActionBar from "@/components/shared/BulkActionBar";
import PlatformFeeScale from "@/components/organizer/PlatformFeeScale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const FEATURES = [
  { key: "tickets",          label: "Ticket Sales" },
  { key: "merch",            label: "Merch Shop" },
  { key: "donations",        label: "Donations" },
  { key: "shoutouts",        label: "Shoutouts" },
  { key: "fan_tiers",        label: "Fan Subscriptions" },
  { key: "digital_products", label: "Digital Downloads" },
  // Note: bookings intentionally excluded from white label fee — no booking fee
];

const BLANK = {
  name: "", email: "", brand_name: "", notes: "",
  can_add_artists: true, can_add_organizers: true, is_active: true,
  permitted_features: [],
  revenue_rates: { tickets: 0, merch: 0, donations: 0, shoutouts: 0, fan_tiers: 0, digital_products: 0 },
  ticket_fee_type: "percentage",
  ticket_fee_flat: 0,
  extra_ticket_fee_pct: 0,
  extra_ticket_fee_flat: 0,
  domain: "",
};

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "list", label: "All White Labels", icon: List },
];

export default function AdminWhiteLabels() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("overview");
  // Invite flow state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState("email"); // "email" | "link"
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState(""); // inline form error
  const [inviteEmailSentFailed, setInviteEmailSentFailed] = useState(false); // email step failed
  const [inviteLinkGenerated, setInviteLinkGenerated] = useState(false); // link-only mode done
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [feeScaleOpen, setFeeScaleOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const toggleSelectWL = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkDeleteWL = async () => {
    const ids = [...selectedIds];
    // Cascade: delete all Sub-WL proposals and sub-WL records for each deleted WL
    let totalCascaded = 0;
    for (const id of ids) {
      const subProposals = await base44.entities.WhiteLabelFeeProposal.filter({ parent_wl_id: id }, null, 100).catch(() => []);
      await Promise.all(subProposals.map(p => base44.entities.WhiteLabelFeeProposal.delete(p.id).catch(() => {})));
      const subWLs = await base44.entities.WhiteLabel.filter({ parent_wl_id: id }, null, 100).catch(() => []);
      await Promise.all(subWLs.map(wl => base44.entities.WhiteLabel.delete(wl.id).catch(() => {})));
      totalCascaded += subProposals.length + subWLs.length;
    }
    await Promise.all(ids.map(id => base44.entities.WhiteLabel.delete(id).catch(() => {})));
    setAgents(prev => prev.filter(a => !ids.includes(a.id) && !ids.includes(a.parent_wl_id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} white label${ids.length !== 1 ? "s" : ""} deleted${totalCascaded > 0 ? ` + ${totalCascaded} Sub-WL record(s) removed` : ""}`);
  };
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "pending"
  const [searchQuery, setSearchQuery] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [feeForm, setFeeForm] = useState({ fee_type: "percentage", fee_percent: 0, fee_flat: 0, effective_from: "" });
  const [feeHistory, setFeeHistory] = useState([]);
  const [feeLoading, setFeeLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { if (u?.email) setAdminEmail(u.email); }).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.WhiteLabel.list("-created_date", 100).then(a => {
      // Deduplicate by email (case-insensitive) — keep the most recently created per email
      const seen = new Set();
      const deduped = a.filter(wl => {
        const key = (wl.email || "").trim().toLowerCase();
        if (!key || !seen.has(key)) { seen.add(key); return true; }
        return false;
      });
      setAgents(deduped);
      setLoading(false);
    });
  }, []);

  const loadFeeHistory = async (agentId) => {
    setFeeLoading(true);
    const configs = await base44.entities.WLFeeConfig.filter({ child_wl_id: agentId }, "-effective_from", 20).catch(() => []);
    setFeeHistory(configs);
    const active = configs.find(c => c.is_active);
    if (active) {
      setFeeForm({
        fee_type: active.fee_type || "percentage",
        fee_percent: active.fee_percent || 0,
        fee_flat: active.fee_flat || 0,
        effective_from: active.effective_from ? active.effective_from.slice(0, 16) : "",
      });
    } else {
      setFeeForm({ fee_type: "percentage", fee_percent: 0, fee_flat: 0, effective_from: "" });
    }
    setFeeLoading(false);
  };

  const handleSaveReizorFee = async () => {
    if (!editing) return;
    setSaving(true);
    const now = new Date().toISOString();
    const effectiveFrom = feeForm.effective_from ? new Date(feeForm.effective_from).toISOString() : now;

    // Deactivate old active config
    const oldActive = feeHistory.find(c => c.is_active);
    if (oldActive) {
      await base44.entities.WLFeeConfig.update(oldActive.id, { is_active: false }).catch(() => {});
    }

    // Create new immutable fee record
    await base44.entities.WLFeeConfig.create({
      parent_type: "reizor",
      parent_wl_id: null,
      parent_wl_name: "Reizor",
      parent_wl_email: adminEmail,
      child_wl_id: editing.id,
      child_wl_name: editing.brand_name || editing.name,
      child_wl_email: editing.email,
      fee_type: feeForm.fee_type,
      fee_percent: parseFloat(feeForm.fee_percent) || 0,
      fee_flat: parseFloat(feeForm.fee_flat) || 0,
      effective_from: effectiveFrom,
      is_active: true,
      created_by_email: adminEmail,
      created_by_role: "admin",
    });

    toast.success("Reizor platform fee saved for this White Label");
    await loadFeeHistory(editing.id);
    setSaving(false);
  };

  const openEdit = (agent) => {
    setEditing(agent);
    loadFeeHistory(agent.id);
    setForm({
      name: agent.name || "",
      email: agent.email || "",
      brand_name: agent.brand_name || "",
      notes: agent.notes || "",
      can_add_artists: agent.can_add_artists !== false,
      can_add_organizers: agent.can_add_organizers !== false,
      is_active: agent.is_active !== false,
      permitted_features: agent.permitted_features || [],
      revenue_rates: { ...BLANK.revenue_rates, ...(agent.revenue_rates || {}) },
      ticket_fee_type: agent.ticket_fee_type || "percentage",
      ticket_fee_flat: agent.ticket_fee_flat || 0,
      extra_ticket_fee_pct: agent.extra_ticket_fee_pct || 0,
      extra_ticket_fee_flat: agent.extra_ticket_fee_flat || 0,
      logo_url: agent.logo_url || "",
      domain: agent.domain || "",
    });
    setOpen(true);
  };

  const toggleFeature = (key) => {
    setForm(f => ({
      ...f,
      permitted_features: f.permitted_features.includes(key)
        ? f.permitted_features.filter(k => k !== key)
        : [...f.permitted_features, key],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return toast.error("Name and email are required");
    const normalizedEmail = form.email.trim().toLowerCase();
    const duplicateWL = agents.find(a => a.id !== editing.id && a.email?.trim().toLowerCase() === normalizedEmail);
    if (duplicateWL) return toast.error("This email is already connected to another White Label account.");
    if (normalizedEmail !== (editing.email || "").trim().toLowerCase()) {
      const check = await base44.functions.invoke('checkWLEmailAvailable', { email: normalizedEmail, excludeWlId: editing.id }).catch(err => ({
        data: { available: false, message: err?.response?.data?.error || "Could not verify this email. Please try again." },
      }));
      if (!check?.data?.available) return toast.error(check?.data?.message || "This email cannot be used.");
    }
    setSaving(true);
    await base44.entities.WhiteLabel.update(editing.id, { ...form, email: normalizedEmail });
    setAgents(prev => prev.map(a => a.id === editing.id ? { ...a, ...form, email: normalizedEmail } : a));
    toast.success("White label updated");
    setSaving(false);
    setOpen(false);
  };

  const handleDelete = async (id) => {
    // Cascade: delete all Sub-WL proposals linked to this White Label
    const subProposals = await base44.entities.WhiteLabelFeeProposal.filter({ parent_wl_id: id }, null, 100).catch(() => []);
    await Promise.all(subProposals.map(p => base44.entities.WhiteLabelFeeProposal.delete(p.id).catch(() => {})));
    // Cascade: delete any Sub-WL WhiteLabel records with this parent
    const subWLs = await base44.entities.WhiteLabel.filter({ parent_wl_id: id }, null, 100).catch(() => []);
    await Promise.all(subWLs.map(wl => base44.entities.WhiteLabel.delete(wl.id).catch(() => {})));
    await base44.entities.WhiteLabel.delete(id);
    setAgents(prev => prev.filter(a => a.id !== id && a.parent_wl_id !== id));
    setConfirmDeleteId(null);
    toast.success(`White label deleted${subProposals.length + subWLs.length > 0 ? ` along with ${subProposals.length + subWLs.length} related Sub-WL record(s)` : ""}`);
  };

  const toggleActive = async (agent) => {
    await base44.entities.WhiteLabel.update(agent.id, { is_active: !agent.is_active });
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
  };

  // ── Invite flow ──
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendInvite = async () => {
    setInviteError("");
    const normalizedInviteEmail = inviteEmail.trim().toLowerCase();

    // Field-level validation
    if (!normalizedInviteEmail) {
      setInviteError("Email is required.");
      return;
    }
    if (!isValidEmail(normalizedInviteEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setInviteSending(true);
    setInviteEmailSentFailed(false);

    // Server-side check: blocks any existing user (admin/organizer/artist/fan/WL) or pending invite
    const check = await base44.functions.invoke('checkWLEmailAvailable', { email: normalizedInviteEmail }).catch(err => ({
      data: { available: false, message: err?.response?.data?.error || "Could not verify this email. Please try again." },
    }));
    if (!check?.data?.available) {
      setInviteError(check?.data?.message || "This email cannot be used.");
      setInviteSending(false);
      return;
    }

    // Create the WL record
    let created;
    const now = new Date();
    try {
      created = await base44.entities.WhiteLabel.create({
        name: inviteName.trim() || normalizedInviteEmail,
        email: normalizedInviteEmail,
        is_active: false,
        can_add_artists: true,
        can_add_organizers: true,
        permitted_features: [],
        revenue_rates: {},
        signup_status: "invited",
        invite_sent_at: now.toISOString(),
        invite_expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err) {
      setInviteError(err?.message || "Could not create the White Label account. Please try again.");
      setInviteSending(false);
      return;
    }

    // Build invite link using production domain
    const link = `https://reizor.com/agent-dashboard?setup=1&wl_id=${created.id}&email=${encodeURIComponent(normalizedInviteEmail)}`;
    setInviteLink(link);
    setAgents(prev => [created, ...prev]);

    // Send invite email via dedicated backend function (uses service role Gmail — works for any caller)
    let emailOk = false;
    try {
      await base44.functions.invoke('sendWLInvite', {
        to: normalizedInviteEmail,
        name: inviteName.trim(),
        link,
        senderName: "Reizor",
        role: "white_label",
        _source: "AdminWhiteLabels/invite",
      });
      emailOk = true;
    } catch (err) {
      console.error("[AdminWhiteLabels] Email send failed:", err);
      setInviteError(err?.response?.data?.error || err?.message || "Failed to send invite email.");
      setInviteEmailSentFailed(true);
    }

    if (emailOk) toast.success(`Invite sent to ${normalizedInviteEmail}`);
    setInviteSending(false);
  };

  const handleResendEmail = async () => {
    if (!inviteLink) return;
    setInviteEmailSentFailed(false);
    setInviteSending(true);
    const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
    try {
      await base44.functions.invoke('sendWLInvite', {
        to: normalizedInviteEmail,
        name: inviteName.trim(),
        link: inviteLink,
        senderName: "Reizor",
        role: "white_label",
        _source: "AdminWhiteLabels/resend",
      });
      await base44.entities.WhiteLabel.filter({ email: normalizedInviteEmail }, null, 1).then(res => {
        if (res[0]) base44.entities.WhiteLabel.update(res[0].id, { invite_sent_at: new Date().toISOString() }).catch(() => {});
      }).catch(() => {});
      toast.success("Invite email resent successfully.");
    } catch (err) {
      setInviteEmailSentFailed(true);
      toast.error(err?.response?.data?.error || err?.message || "Could not send email. Please copy the link manually.");
    }
    setInviteSending(false);
  };

  const handleCancelInvite = async (agent) => {
    if (!window.confirm(`Cancel the invite for ${agent.email}?`)) return;
    await base44.entities.WhiteLabel.update(agent.id, { signup_status: "cancelled", is_active: false });
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, signup_status: "cancelled", is_active: false } : a));
    toast.success("Invite cancelled. This email can now be re-invited.");
  };

  const handleGenerateLink = async () => {
    setInviteError("");
    // Link-only flow: no email required. Generate a reusable, shareable
    // invite link. No WhiteLabel record is created upfront — the partner
    // creates their account when they open the link and complete setup.
    setInviteSending(true);
    const link = `https://reizor.com/agent-dashboard?setup=1&role=white_label`;
    setInviteLink(link);
    setInviteLinkGenerated(true);
    setInviteSending(false);
  };

  const copyInviteLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteLink).then(() => toast.success("Link copied!")).catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    const el = document.createElement("textarea");
    el.value = inviteLink;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    toast.success("Link copied!");
  };

  const activeAgents = agents.filter(a => a.is_active !== false && a.brand_name).length;
  const pendingAgents = agents.filter(a => a.signup_status === "invited" || !a.brand_name).length;
  const setupCompleted = agents.filter(a => a.brand_name && a.is_active !== false).length;

  const filteredAgents = agents.filter(a => {
    const matchStatus = statusFilter === "all"
      ? true
      : statusFilter === "active"
      ? (a.is_active !== false && a.brand_name)
      : statusFilter === "pending"
      ? (a.signup_status === "invited" || !a.brand_name)
      : true;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (a.brand_name || "").toLowerCase().includes(q)
      || (a.name || "").toLowerCase().includes(q)
      || (a.email || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {!loading && (<>

      {/* ── Header ── */}
      <div className="space-y-4">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">WHITE LABELS</h1>
          <p className="text-sm text-muted-foreground mt-1">Invite and manage white label partners — they run their own artists & organizers</p>
        </div>
        {/* Actions row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            onClick={() => { setInviteEmail(""); setInviteName(""); setInviteLink(""); setInviteError(""); setInviteEmailSentFailed(false); setInviteLinkGenerated(false); setInviteMethod("email"); setInviteOpen(true); }}
            className="glow-lime font-display font-bold gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add White Label
          </Button>
          <div className="flex gap-2 sm:ml-2">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                  section === s.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Overview ── */}
      {section === "overview" && (
        <div className="space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "all",     label: "Total",         value: agents.length,  Icon: Globe,         color: "text-primary",      bg: "bg-primary/10",      border: "border-primary/30" },
              { key: "active",  label: "Active",        value: activeAgents,   Icon: CheckCircle,   color: "text-green-400",    bg: "bg-green-400/10",    border: "border-green-400/30" },
              { key: "pending", label: "Pending Setup", value: pendingAgents,  Icon: Clock,         color: "text-yellow-400",   bg: "bg-yellow-400/10",   border: "border-yellow-400/30" },
              { key: null,      label: "Setup Done",    value: setupCompleted, Icon: Users,         color: "text-accent",       bg: "bg-accent/10",       border: "border-accent/30" },
            ].map(card => {
              const isSelected = statusFilter === card.key;
              return (
                <button
                  key={String(card.key)}
                  onClick={() => card.key !== null && setStatusFilter(prev => prev === card.key ? "all" : card.key)}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 ${card.key !== null ? "cursor-pointer" : "cursor-default"} ${
                    isSelected ? `${card.bg} ${card.border} ring-1 ring-offset-0` : "bg-card border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-tight">{card.label}</span>
                    <card.Icon className={`w-4 h-4 shrink-0 ${isSelected ? card.color : "text-muted-foreground/50"}`} />
                  </div>
                  <p className={`font-display font-black text-3xl tabular-nums ${isSelected ? card.color : "text-foreground"}`}>{card.value}</p>
                  {isSelected && card.key !== null && (
                    <p className={`text-[10px] font-mono mt-1.5 font-bold ${card.color}`}>● Filtering</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Recent activity list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base">Recent Partners</h2>
              {statusFilter && statusFilter !== "all" && (
                <button onClick={() => setStatusFilter("all")} className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear filter
                </button>
              )}
            </div>
            {agents.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border/50">
                <Globe className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-display font-bold text-foreground mb-1">No white labels yet</p>
                <p className="text-sm text-muted-foreground">Invite your first partner using the "Add White Label" button above to get started</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-xl border border-border/50">
                <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No white labels match this filter</p>
                <button onClick={() => setStatusFilter("all")} className="mt-2 text-xs font-mono text-primary hover:underline">Clear filter</button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAgents.slice(0, 8).map(agent => {
                  const isCancelled = agent.signup_status === "cancelled";
                  const isPending = !isCancelled && (agent.signup_status === "invited" || !agent.brand_name);
                  return (
                    <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                      {/* Avatar */}
                      {agent.logo_url ? (
                        <img src={agent.logo_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {(agent.brand_name || agent.name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{agent.brand_name || agent.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{agent.email}</p>
                      </div>
                      {/* Status badge */}
                      <span className={`shrink-0 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                        isCancelled
                          ? "text-muted-foreground bg-muted border-border/30"
                          : isPending
                          ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                          : "text-green-400 bg-green-400/10 border-green-400/20"
                      }`}>
                        {isCancelled ? "Cancelled" : isPending ? "Pending" : "Active"}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(agent)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit settings">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(agent.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredAgents.length > 8 && (
                  <button onClick={() => setSection("list")} className="w-full py-2.5 text-xs font-mono text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/20 transition-colors">
                    View all {filteredAgents.length} white labels →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── All White Labels ── */}
      {section === "list" && (
        <div className="space-y-4">

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9 bg-card border-border/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {[
                { key: "all",     label: "All" },
                { key: "active",  label: "Active" },
                { key: "pending", label: "Pending" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-all ${
                    statusFilter === f.key
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          {(searchQuery || statusFilter !== "all") && (
            <p className="text-xs text-muted-foreground font-mono">
              {filteredAgents.length} result{filteredAgents.length !== 1 ? "s" : ""}
              {searchQuery && <> for "<span className="text-foreground">{searchQuery}</span>"</>}
            </p>
          )}

          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={filteredAgents.length}
            onSelectAll={() => setSelectedIds(new Set(filteredAgents.map(a => a.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            deleteLabel={`Delete ${selectedIds.size} White Label${selectedIds.size !== 1 ? "s" : ""}`}
          />

          {/* Empty states */}
          {agents.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border/50">
              <Globe className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-display font-bold text-foreground mb-1">No white labels yet</p>
              <p className="text-sm text-muted-foreground">Invite your first partner using the "Add White Label" button above to get started</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border/50">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">No results found</p>
              <p className="text-sm text-muted-foreground mb-3">Try adjusting your search or filter</p>
              <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-xs font-mono text-primary hover:underline">Clear all filters</button>
            </div>
          ) : (
            /* List */
            <div className="space-y-3">
              {filteredAgents.map(agent => {
                const isExp = expanded === agent.id;
                const isCancelled = agent.signup_status === "cancelled";
                const isPending = !isCancelled && (agent.signup_status === "invited" || !agent.brand_name);
                const featureCount = (agent.permitted_features || []).length;
                const isSelected = selectedIds.has(agent.id);
                return (
                  <div key={agent.id} className={`rounded-xl border overflow-hidden transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "bg-card border-border/50 hover:border-border"}`}>

                    {/* ── Card body ── */}
                    <div className="p-4 space-y-3">

                      {/* Row 1: Checkbox + Avatar + Name + Status */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleSelectWL(agent.id)}
                          className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary" : "border-border/60 hover:border-primary/50"}`}
                          aria-label="Select white label"
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="shrink-0">
                          {agent.logo_url ? (
                            <img src={agent.logo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-base">
                              {(agent.brand_name || agent.name || "?")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display font-bold text-sm leading-tight truncate max-w-[160px] sm:max-w-none">
                              {agent.brand_name || agent.name || "Unnamed"}
                            </p>
                            <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              isCancelled
                                ? "text-muted-foreground bg-muted border-border/30"
                                : isPending
                                ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                                : "text-green-400 bg-green-400/10 border-green-400/20"
                            }`}>
                              {isCancelled ? "Cancelled" : isPending ? "Pending" : "Active"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Email */}
                      <p className="text-xs text-muted-foreground font-mono break-all leading-relaxed pl-[52px]">
                        {agent.email}
                      </p>

                      {/* Row 3: Joined date + domain */}
                      <div className="flex items-center gap-3 flex-wrap pl-[52px]">
                        {agent.created_date && (
                          <span className="text-[11px] font-mono text-muted-foreground/70">
                            Joined {format(new Date(agent.created_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {agent.domain && (
                          <span className="text-[11px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                            {agent.domain}
                          </span>
                        )}
                      </div>

                      {/* Row 4: Permission chips */}
                      <div className="flex items-center gap-2 flex-wrap pl-[52px]">
                        {agent.can_add_artists && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Check className="w-2.5 h-2.5" /> Artists
                          </span>
                        )}
                        {agent.can_add_organizers && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            <Check className="w-2.5 h-2.5" /> Organizers
                          </span>
                        )}
                        {featureCount > 0 && (
                          <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/40">
                            {featureCount} feature{featureCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Row 5: Action buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pl-[52px] pt-1 border-t border-border/20">
                        <a
                          href={`/agent-dashboard?id=${agent.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                        <button
                          onClick={() => openEdit(agent)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(agent.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                          onClick={() => setExpanded(isExp ? null : agent.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                        >
                          {isExp ? <><ChevronUp className="w-3.5 h-3.5" /> Less</> : <><ChevronDown className="w-3.5 h-3.5" /> More</>}
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded details ── */}
                    {isExp && (
                      <div className="border-t border-border/30 p-4 space-y-4 bg-secondary/30">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Fee Structure</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-muted-foreground mb-0.5">Platform fee</p>
                              <p className="text-foreground font-bold">Tiered $0.50–$5</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-muted-foreground mb-0.5">WL extra %</p>
                              <p className={`font-bold ${(agent.extra_ticket_fee_pct || 0) > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                                {(agent.extra_ticket_fee_pct || 0) > 0 ? `+${agent.extra_ticket_fee_pct}%` : "None"}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/30">
                              <p className="text-muted-foreground mb-0.5">WL flat fee</p>
                              <p className={`font-bold ${(agent.extra_ticket_fee_flat || 0) > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                                {(agent.extra_ticket_fee_flat || 0) > 0 ? `+$${Number(agent.extra_ticket_fee_flat).toFixed(2)}` : "None"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => toggleActive(agent)}
                            className={agent.is_active ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-green-400/30 text-green-400 hover:bg-green-400/10"}>
                            {agent.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          {isPending && agent.signup_status !== "cancelled" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => {
                                const link = `${window.location.origin}/agent-dashboard?setup=1&wl_id=${agent.id}&email=${encodeURIComponent(agent.email)}`;
                                navigator.clipboard?.writeText(link).then(() => toast.success("Invite link copied!")).catch(() => {});
                              }} className="gap-1.5 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10">
                                <Copy className="w-3.5 h-3.5" /> Copy Invite Link
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleCancelInvite(agent)}
                                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10">
                                <X className="w-3.5 h-3.5" /> Cancel Invite
                              </Button>
                            </>
                          )}
                          {agent.signup_status === "cancelled" && (
                            <span className="text-xs font-mono text-muted-foreground">Invite cancelled — can be re-invited</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      </>)}

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteError(""); setInviteEmailSentFailed(false); setInviteLinkGenerated(false); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Invite White Label Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Method selector — only shown before action taken */}
            {!inviteLink && !inviteLinkGenerated && (
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${inviteMethod === "email" ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-muted-foreground hover:border-primary/30"}`}>
                  <Mail className="w-4 h-4" /> Send Email
                </button>
                <button
                  onClick={() => setInviteMethod("link")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${inviteMethod === "link" ? "border-accent bg-accent/10 text-accent" : "border-border/50 bg-secondary text-muted-foreground hover:border-accent/30"}`}>
                  <Copy className="w-4 h-4" /> Copy Link
                </button>
              </div>
            )}

            {/* Input fields */}
            {!inviteLink && !inviteLinkGenerated && (
              <div className="space-y-3">
                {inviteMethod === "email" && (
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Email *</Label>
                    <Input
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }}
                      placeholder="partner@example.com"
                      className={`mt-1 bg-secondary ${inviteError ? "border-destructive" : "border-border/50"}`}
                    />
                    {inviteError && (
                      <p className="mt-1 text-xs text-destructive font-mono">{inviteError}</p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Contact / Brand Name (optional)</Label>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)}
                    placeholder="Jane Smith" className="mt-1 bg-secondary border-border/50" />
                </div>
                {inviteMethod === "link" && (
                  <p className="text-xs font-mono text-muted-foreground bg-accent/5 border border-accent/20 rounded-lg p-2.5">
                    No email needed — a reusable invite link will be generated. Copy and share it through any channel.
                  </p>
                )}
              </div>
            )}

            {/* ── Email flow result ── */}
            {inviteLink && !inviteLinkGenerated && (
              <div className="space-y-3">
                {inviteEmailSentFailed ? (
                  <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                    <p className="text-xs font-mono text-yellow-400 font-bold mb-1">⚠️ Account created, but invite email could not be sent.</p>
                    <p className="text-xs text-muted-foreground mb-2">Copy the link below to share manually, or try resending.</p>
                    <div className="flex gap-2 mb-2">
                      <input readOnly value={inviteLink}
                        className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-xs font-mono text-muted-foreground" />
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyInviteLink}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Button size="sm" onClick={handleResendEmail} disabled={inviteSending} className="w-full glow-lime font-display font-bold gap-2">
                      <Send className="w-3.5 h-3.5" /> {inviteSending ? "Resending..." : "Resend Email"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/20">
                    <p className="text-xs font-mono text-green-400 font-bold mb-2">✅ Invite sent! Share this link if needed:</p>
                    <div className="flex gap-2">
                      <input readOnly value={inviteLink}
                        className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-xs font-mono text-muted-foreground" />
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyInviteLink}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <Button variant="outline" onClick={() => setInviteOpen(false)} className="w-full">Done</Button>
              </div>
            )}

            {/* ── Link-only flow result ── */}
            {inviteLinkGenerated && inviteLink && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs font-mono text-accent font-bold mb-2">🔗 Reusable invite link generated! Copy and share it:</p>
                  <div className="flex gap-2">
                    <input readOnly value={inviteLink}
                      className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-xs font-mono text-muted-foreground" />
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyInviteLink}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full glow-lime font-display font-bold gap-2" onClick={copyInviteLink}>
                  <Copy className="w-4 h-4" /> Copy Invite Link
                </Button>
                <Button variant="outline" onClick={() => setInviteOpen(false)} className="w-full">Done</Button>
              </div>
            )}

            {/* ── Action buttons ── */}
            {!inviteLink && !inviteLinkGenerated && (
              <div className="flex gap-2">
                {inviteMethod === "email" ? (
                  <Button onClick={handleSendInvite} disabled={inviteSending} className="flex-1 glow-lime font-display font-bold gap-2">
                    <Send className="w-4 h-4" /> {inviteSending ? "Sending..." : "Send Invite Email"}
                  </Button>
                ) : (
                  <Button onClick={handleGenerateLink} disabled={inviteSending} className="flex-1 font-display font-bold gap-2 bg-accent hover:bg-accent/90">
                    <Copy className="w-4 h-4" /> {inviteSending ? "Generating..." : "Generate Invite Link"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Delete Confirmation ── */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <p className="font-display font-bold text-base">Delete {selectedIds.size} White Label{selectedIds.size !== 1 ? "s" : ""}?</p>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete the selected white labels? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 rounded-lg border border-border/50 text-sm font-mono font-medium hover:bg-muted transition-colors" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
              <button className="flex-1 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-mono font-bold hover:bg-destructive/90 transition-colors" onClick={bulkDeleteWL}>Delete Selected</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-black">Delete White Label?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this white label partner, all their settings, and any connected Sub-White-Label proposals and accounts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Settings Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-black">White Label Settings — {editing?.brand_name || editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Contact Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="wl@example.com" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Brand Name</Label>
                <Input value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                  placeholder="Creative Agency LLC" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Logo URL</Label>
                <Input value={form.logo_url || ""} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..." className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Custom Domain (optional)</Label>
                <Input value={form.domain || ""} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="events.yourbrand.com" className="mt-1 bg-secondary border-border/50" />
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">If provided, their branded page will be mapped to this domain. Leave blank to use auto-generated subdomain.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-2">
              <p className="font-display font-bold text-sm">Status & Permissions</p>
              <div className="flex gap-4 flex-wrap">
                {[
                  { key: "is_active", label: "Active" },
                  { key: "can_add_artists", label: "Can Invite Artists" },
                  { key: "can_add_organizers", label: "Can Invite Organizers" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="rounded" />
                    <span className="text-sm font-mono">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fee Structure */}
            <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
              <div>
                <p className="font-display font-bold text-sm">Ticket Fee Structure</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Platform fee is always applied (tiered $0.50–$5). White label can add an EXTRA fee on top — this extra belongs to the white label.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/30 text-xs font-mono text-muted-foreground flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFeeScaleOpen(true)}
                  className="flex items-center gap-1 text-primary hover:underline whitespace-nowrap font-bold shrink-0"
                >
                  <Info className="w-3 h-3" />Click here to see platform fee schedule
                </button>
              </div>

              {/* Fee Scale Popup */}
              {feeScaleOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={() => setFeeScaleOpen(false)}>
                  <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                      <p className="font-display font-bold text-sm">Platform Fee Scale</p>
                      <button onClick={() => setFeeScaleOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      <PlatformFeeScale />
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-mono text-green-400 font-bold uppercase tracking-wider">White Label Extra Fee (kept by white label)</p>
                <div className="flex gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-mono text-muted-foreground whitespace-nowrap">% extra per ticket</Label>
                    <Input type="number" min="0" max="100" step="0.5" value={form.extra_ticket_fee_pct || 0}
                      onChange={e => setForm(f => ({ ...f, extra_ticket_fee_pct: parseFloat(e.target.value) || 0 }))}
                      className="w-20 bg-background border-border/50 text-right text-sm h-8" />
                    <span className="text-xs font-mono text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-mono text-muted-foreground whitespace-nowrap">$ flat per ticket</Label>
                    <span className="text-xs font-mono text-muted-foreground">$</span>
                    <Input type="number" min="0" step="0.01" value={form.extra_ticket_fee_flat || 0}
                      onChange={e => setForm(f => ({ ...f, extra_ticket_fee_flat: parseFloat(e.target.value) || 0 }))}
                      className="w-24 bg-background border-border/50 text-right text-sm h-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Share for non-ticket features */}
            <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
              <div>
                <p className="font-display font-bold text-sm">Feature Revenue Share</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Enable features and set white label's % share from their managed artists. Artist bookings are always fee-free.</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-xs font-mono text-muted-foreground">
                ℹ Artist Bookings: <span className="text-green-400 font-bold">0% platform fee</span> — bookings are not charged.
              </div>
              <div className="space-y-2">
                {FEATURES.filter(f => f.key !== "tickets").map(({ key, label }) => {
                  const enabled = form.permitted_features.includes(key);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <button onClick={() => toggleFeature(key)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${enabled ? "bg-primary border-primary" : "border-border/50"}`}>
                        {enabled && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className={`text-sm font-mono flex-1 ${enabled ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" max="100" step="0.5" disabled={!enabled}
                          value={form.revenue_rates[key] || 0}
                          onChange={e => setForm(f => ({ ...f, revenue_rates: { ...f.revenue_rates, [key]: parseFloat(e.target.value) || 0 } }))}
                          className="w-20 bg-background border-border/50 text-right text-sm h-8" />
                        <span className="text-xs font-mono text-muted-foreground">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">Internal Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Any notes about this white label..."
                className="mt-1 w-full rounded-md bg-background border border-border/50 px-3 py-2 text-sm resize-none" />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full glow-lime font-display font-bold">
              {saving ? "Saving..." : "Save Settings"}
            </Button>

            {/* ── Reizor Platform Fee for this WL ── */}
            <div className="border-t border-border/50 pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="font-display font-bold text-sm">Reizor → WL Platform Fee</p>
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">Admin Only</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono -mt-2">
                This fee is charged by Reizor to this White Label on every paid transaction. It stacks on top of the base Reizor platform fee (tiered $0.50–$5 per ticket). The WL cannot view or edit this value.
              </p>

              {feeLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  <span className="text-xs font-mono text-muted-foreground">Loading fee config...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ v: "percentage", l: "% Only" }, { v: "flat", l: "$ Flat" }, { v: "both", l: "% + $" }].map(({ v, l }) => (
                      <button key={v} type="button" onClick={() => setFeeForm(f => ({ ...f, fee_type: v }))}
                        className={`py-2 rounded-lg text-xs font-mono font-bold border transition-all ${feeForm.fee_type === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                        {l}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 items-end">
                    {(feeForm.fee_type === "percentage" || feeForm.fee_type === "both") && (
                      <div>
                        <Label className="text-xs font-mono text-muted-foreground">Percentage (%)</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input type="number" min="0" max="100" step="0.1" value={feeForm.fee_percent}
                            onChange={e => setFeeForm(f => ({ ...f, fee_percent: e.target.value }))}
                            className="w-24 bg-background border-border/50 h-8 text-sm text-right" />
                          <span className="text-xs font-mono text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                    {(feeForm.fee_type === "flat" || feeForm.fee_type === "both") && (
                      <div>
                        <Label className="text-xs font-mono text-muted-foreground">Flat per ticket ($)</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-mono text-muted-foreground">$</span>
                          <Input type="number" min="0" step="0.01" value={feeForm.fee_flat}
                            onChange={e => setFeeForm(f => ({ ...f, fee_flat: e.target.value }))}
                            className="w-24 bg-background border-border/50 h-8 text-sm text-right" />
                        </div>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-mono text-muted-foreground">Effective from</Label>
                      <Input type="datetime-local" value={feeForm.effective_from}
                        onChange={e => setFeeForm(f => ({ ...f, effective_from: e.target.value }))}
                        className="mt-1 bg-background border-border/50 h-8 text-xs" />
                    </div>
                  </div>

                  <Button onClick={handleSaveReizorFee} disabled={saving} size="sm" className="glow-lime font-display font-bold gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Fee Configuration"}
                  </Button>

                  {/* Fee history */}
                  {feeHistory.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <History className="w-3 h-3" /> Fee Audit Trail ({feeHistory.length} records)
                      </p>
                      {feeHistory.slice(0, 5).map(h => (
                        <div key={h.id} className={`flex items-center gap-2 p-2 rounded text-xs font-mono ${h.is_active ? "bg-green-400/5 border border-green-400/20" : "bg-muted/30 border border-border/20"}`}>
                          <span className={h.is_active ? "text-green-400 font-bold" : "text-muted-foreground"}>
                            {h.is_active ? "● Active" : "○"}
                          </span>
                          <span className="text-foreground flex-1">
                            {h.fee_type === "percentage" ? `${h.fee_percent}%` : h.fee_type === "flat" ? `$${h.fee_flat}/ticket` : `${h.fee_percent}% + $${h.fee_flat}`}
                          </span>
                          <span className="text-muted-foreground">{h.effective_from ? new Date(h.effective_from).toLocaleDateString() : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}