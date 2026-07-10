import { useState, useEffect } from "react";
import { X, Check, RefreshCw, Trash2, Building2, Mail, Phone, Calendar, DollarSign, Ticket, Users, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_STYLE = {
  pending:   { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  accepted:  { label: "Accepted",  color: "text-green-400 bg-green-400/10 border-green-400/30" },
  agreed:    { label: "Agreed",    color: "text-green-400 bg-green-400/10 border-green-400/30" },
  refused:   { label: "Refused",   color: "text-destructive bg-destructive/10 border-destructive/30" },
  countered: { label: "Countered", color: "text-accent bg-accent/10 border-accent/30" },
};

export default function SubWLDetailModal({ proposal, parentWL, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState("details");
  const [actionType, setActionType] = useState("percentage");
  const [percent, setPercent] = useState(0);
  const [flat, setFlat] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const p = proposal;
  const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;

  useEffect(() => {
    if (tab === "performance" && !perf) loadPerf();
  }, [tab]);

  const loadPerf = async () => {
    setPerfLoading(true);
    try {
      const [orders, events, tickets] = await Promise.all([
        base44.entities.Order.list("-created_date", 500).catch(() => []),
        base44.entities.Event.list(null, 500).catch(() => []),
        base44.entities.Ticket.list(null, 500).catch(() => []),
      ]);
      // Filter by sub-WL email as organizer or created_by
      const subEmail = p.sub_wl_email?.toLowerCase();
      const subOrders = orders.filter(o =>
        o.organizer_email?.toLowerCase() === subEmail ||
        o.created_by?.toLowerCase() === subEmail
      );
      const subEvents = events.filter(e =>
        e.created_by?.toLowerCase() === subEmail
      );
      const subTickets = tickets.filter(t =>
        subOrders.some(o => o.id === t.order_id)
      );
      const totalRevenue = subOrders.filter(o => o.status === "completed").reduce((s, o) => s + (o.total || 0), 0);
      const totalTickets = subTickets.filter(t => t.status === "active" || t.status === "scanned").length;
      setPerf({ orders: subOrders, events: subEvents, tickets: subTickets, totalRevenue, totalTickets });
    } catch {
      setPerf({ orders: [], events: [], tickets: [], totalRevenue: 0, totalTickets: 0 });
    }
    setPerfLoading(false);
  };

  const feeLabel = (pr) => {
    if (!pr) return "—";
    if (pr.proposed_fee_type === "percentage") return `${pr.proposed_fee_percent || 0}% per ticket`;
    if (pr.proposed_fee_type === "flat") return `$${(pr.proposed_fee_flat || 0).toFixed(2)} per ticket`;
    return `${pr.proposed_fee_percent || 0}% + $${(pr.proposed_fee_flat || 0).toFixed(2)} per ticket`;
  };

  const accept = async () => {
    setSaving(true);
    const subWL = await base44.entities.WhiteLabel.create({
      name: p.sub_wl_name, email: p.sub_wl_email,
      brand_name: p.sub_wl_brand || p.sub_wl_name,
      is_active: true, permitted_features: [],
      revenue_rates: { tickets: 0, merch: 0, donations: 0, shoutouts: 0, fan_tiers: 0, digital_products: 0, bookings: 0 },
      ticket_fee_type: p.proposed_fee_type, ticket_fee_flat: p.proposed_fee_flat || 0,
      parent_white_label_id: p.parent_wl_id, managed_artist_ids: [], managed_organizer_ids: [],
    });
    await base44.entities.WhiteLabelFeeProposal.update(p.id, { status: "accepted", created_wl_id: subWL.id });
    await base44.entities.Notification.create({ user_email: p.parent_wl_email, title: `✅ Sub-WL Approved: ${p.sub_wl_name}`, message: `Admin approved "${p.sub_wl_brand || p.sub_wl_name}".`, type: "general" }).catch(() => {});
    onUpdate({ ...p, status: "accepted", created_wl_id: subWL.id });
    toast.success("Approved — Sub-WL created!");
    setSaving(false);
  };

  const refuse = async () => {
    setSaving(true);
    await base44.entities.WhiteLabelFeeProposal.update(p.id, { status: "refused", admin_note: note || "" });
    await base44.entities.Notification.create({ user_email: p.parent_wl_email, title: `❌ Sub-WL Refused: ${p.sub_wl_name}`, message: `Admin refused.${note ? ` Note: "${note}"` : ""}`, type: "general" }).catch(() => {});
    onUpdate({ ...p, status: "refused", admin_note: note });
    toast.success("Refused.");
    setSaving(false);
  };

  const counter = async () => {
    if (!actionType) return toast.error("Select a fee type");
    setSaving(true);
    await base44.entities.WhiteLabelFeeProposal.update(p.id, {
      status: "countered",
      admin_counter_fee_type: actionType,
      admin_counter_fee_percent: parseFloat(percent) || 0,
      admin_counter_fee_flat: parseFloat(flat) || 0,
      admin_note: note || "",
    });
    await base44.entities.Notification.create({ user_email: p.parent_wl_email, title: `🔄 Counter Offer: ${p.sub_wl_name}`, message: `Admin sent a counter offer. Review in your dashboard.`, type: "general" }).catch(() => {});
    onUpdate({ ...p, status: "countered", admin_counter_fee_type: actionType, admin_counter_fee_percent: parseFloat(percent), admin_counter_fee_flat: parseFloat(flat), admin_note: note });
    toast.success("Counter sent!");
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.WhiteLabelFeeProposal.delete(p.id).catch(() => {});
    onDelete(p.id);
    toast.success("Deleted.");
    setSaving(false);
    onClose();
  };

  const TABS = [
    { key: "details", label: "Details" },
    { key: "fees", label: "Fees & Permissions" },
    { key: "performance", label: "Performance" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card border border-border/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/50 shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-black text-lg truncate">{p.sub_wl_brand || p.sub_wl_name}</h2>
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{p.sub_wl_email}</p>
            {/* Parent WL badge */}
            <div className="flex items-center gap-1.5 mt-2">
              <Building2 className="w-3 h-3 text-primary shrink-0" />
              <span className="text-xs font-mono">
                Belongs to: <span className="text-primary font-bold">{parentWL?.brand_name || parentWL?.name || p.parent_wl_name || "—"}</span>
                {p.parent_wl_email && <span className="text-muted-foreground"> · {p.parent_wl_email}</span>}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* DETAILS TAB */}
          {tab === "details" && (
            <div className="space-y-4">
              <Section title="Sub-White-Label Info">
                <Row icon={Building2} label="Brand Name" value={p.sub_wl_brand || p.sub_wl_name || "—"} />
                <Row icon={Mail} label="Email" value={p.sub_wl_email || "—"} />
                {p.sub_wl_phone && <Row icon={Phone} label="Phone" value={p.sub_wl_phone} />}
                <Row icon={Calendar} label="Requested" value={p.created_date ? format(new Date(p.created_date), "MMM dd, yyyy") : "—"} />
                {(p.status === "accepted" || p.status === "agreed") && p.updated_date && (
                  <Row icon={Check} label="Approved Date" value={format(new Date(p.updated_date), "MMM dd, yyyy")} />
                )}
                {p.status === "refused" && p.updated_date && (
                  <Row icon={X} label="Refused Date" value={format(new Date(p.updated_date), "MMM dd, yyyy")} />
                )}
                {p.admin_note && <Row icon={AlertTriangle} label="Admin Note" value={p.admin_note} />}
              </Section>

              <Section title="Parent White Label">
                <Row icon={Building2} label="Name" value={parentWL?.brand_name || parentWL?.name || p.parent_wl_name || "—"} />
                <Row icon={Mail} label="Email" value={p.parent_wl_email || parentWL?.email || "—"} />
                {parentWL?.phone && <Row icon={Phone} label="Phone" value={parentWL.phone} />}
                {!parentWL && (
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono mt-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Parent White Label not found — this may be an orphan record.
                  </div>
                )}
              </Section>

              {p.created_wl_id && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-green-400 text-xs font-mono">
                  <Check className="w-4 h-4 shrink-0" />
                  Sub-White-Label account created (ID: {p.created_wl_id.slice(-8)})
                </div>
              )}
            </div>
          )}

          {/* FEES & PERMISSIONS TAB */}
          {tab === "fees" && (
            <div className="space-y-4">
              <Section title="Proposed Fee">
                <Row icon={DollarSign} label="Fee Type" value={p.proposed_fee_type || "—"} />
                {(p.proposed_fee_type === "percentage" || p.proposed_fee_type === "both") && (
                  <Row icon={TrendingUp} label="Percentage" value={`${p.proposed_fee_percent || 0}%`} />
                )}
                {(p.proposed_fee_type === "flat" || p.proposed_fee_type === "both") && (
                  <Row icon={DollarSign} label="Flat Fee" value={`$${(p.proposed_fee_flat || 0).toFixed(2)}`} />
                )}
                <Row icon={DollarSign} label="Summary" value={feeLabel(p)} accent />
              </Section>

              {p.status === "countered" && (
                <Section title="Admin Counter Offer">
                  <Row icon={DollarSign} label="Counter Fee Type" value={p.admin_counter_fee_type || "—"} />
                  {(p.admin_counter_fee_type === "percentage" || p.admin_counter_fee_type === "both") && (
                    <Row icon={TrendingUp} label="Counter %" value={`${p.admin_counter_fee_percent || 0}%`} />
                  )}
                  {(p.admin_counter_fee_type === "flat" || p.admin_counter_fee_type === "both") && (
                    <Row icon={DollarSign} label="Counter Flat" value={`$${(p.admin_counter_fee_flat || 0).toFixed(2)}`} />
                  )}
                  {p.admin_note && <Row icon={AlertTriangle} label="Note" value={p.admin_note} />}
                </Section>
              )}

              {p.permitted_features?.length > 0 && (
                <Section title="Permitted Features">
                  <div className="flex flex-wrap gap-2">
                    {p.permitted_features.map(f => (
                      <span key={f} className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{f}</span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* PERFORMANCE TAB */}
          {tab === "performance" && (
            <div className="space-y-4">
              {perfLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {!perfLoading && perf && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <PerfCard icon={DollarSign} label="Total Revenue" value={`$${perf.totalRevenue.toLocaleString()}`} accent />
                    <PerfCard icon={Ticket} label="Tickets Sold" value={perf.totalTickets} />
                    <PerfCard icon={Calendar} label="Events" value={perf.events.length} />
                    <PerfCard icon={Users} label="Orders" value={perf.orders.length} />
                  </div>
                  {perf.events.length > 0 && (
                    <Section title="Connected Events">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {perf.events.slice(0, 10).map(ev => (
                          <div key={ev.id} className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-border/30 last:border-0">
                            <span className="truncate text-foreground">{ev.title}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">{ev.status}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                  {perf.totalRevenue === 0 && perf.events.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground text-sm font-mono">
                      No performance data available yet.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ACTIONS TAB */}
          {tab === "actions" && (
            <div className="space-y-4">
              {p.status === "pending" && (
                <Section title="Take Action">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase">Counter Fee Type</label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {[{v:"percentage",l:"% Only"},{v:"flat",l:"$ Flat"},{v:"both",l:"Both"}].map(({v,l}) => (
                          <button key={v} onClick={() => setActionType(v)}
                            className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border transition-all ${actionType===v?"bg-primary text-white border-primary":"bg-background border-border/50 text-muted-foreground hover:border-primary/40"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap items-center">
                      {(actionType === "percentage" || actionType === "both") && (
                        <div className="flex items-center gap-1.5">
                          <Input type="number" min="0" max="100" step="0.5" value={percent} onChange={e => setPercent(e.target.value)} className="w-20 h-9 text-sm text-right" />
                          <span className="text-xs font-mono text-muted-foreground">%</span>
                        </div>
                      )}
                      {(actionType === "flat" || actionType === "both") && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-muted-foreground">$</span>
                          <Input type="number" min="0" step="0.01" value={flat} onChange={e => setFlat(e.target.value)} className="w-24 h-9 text-sm text-right" />
                        </div>
                      )}
                    </div>
                    <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for the White Label..." className="text-sm" />
                    <div className="flex gap-2 flex-wrap pt-1">
                      <Button size="sm" onClick={accept} disabled={saving} className="gap-1.5 bg-green-500 hover:bg-green-600 text-white border-0 flex-1 justify-center">
                        <Check className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={counter} disabled={saving} className="gap-1.5 border-accent/40 text-accent hover:bg-accent/10 flex-1 justify-center">
                        <RefreshCw className="w-3.5 h-3.5" /> Counter
                      </Button>
                      <Button size="sm" variant="outline" onClick={refuse} disabled={saving} className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 flex-1 justify-center">
                        <X className="w-3.5 h-3.5" /> Refuse
                      </Button>
                    </div>
                  </div>
                </Section>
              )}

              {p.status !== "pending" && (
                <div className="py-4 text-center text-xs font-mono text-muted-foreground">
                  This proposal is <span className={`font-bold ${st.color.split(" ")[0]}`}>{st.label}</span>. No further actions available.
                </div>
              )}

              <Section title="Danger Zone">
                {!confirmDelete ? (
                  <Button variant="outline" onClick={() => setConfirmDelete(true)} className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" /> Delete This Record
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-destructive font-mono">This cannot be undone. Confirm?</p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Cancel</Button>
                      <Button onClick={handleDelete} disabled={saving} className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-0">
                        <Trash2 className="w-4 h-4 mr-1.5" /> Confirm Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{title}</p>
      <div className="rounded-xl bg-secondary/50 border border-border/40 p-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="font-mono">{label}</span>
      </div>
      <span className={`font-mono text-right break-all ${accent ? "text-primary font-bold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function PerfCard({ icon: Icon, label, value, accent }) {
  return (
    <div className={`p-3 rounded-xl border ${accent ? "bg-primary/10 border-primary/30" : "bg-card border-border/50"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />}
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-display font-black text-xl ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}