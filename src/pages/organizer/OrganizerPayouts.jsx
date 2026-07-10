import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Percent, Send, CheckCircle, Clock, XCircle, AlertCircle, Building, CalendarClock, Wallet, ChevronDown } from "lucide-react";
import PayoutFeeBreakdown from "../../components/organizer/PayoutFeeBreakdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import StatCard from "../../components/shared/StatCard";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';
import { format, addDays } from "date-fns";
import { Link } from "react-router-dom";

const PAYOUT_COOLDOWN_DAYS = 14;

// Returns { eligible: bool, nextDate: Date|null, reason: string } for EVENT income
// Does NOT apply cooldown — event income is available anytime
function getEventPayoutEligibility(payoutRequests) {
  const pending = payoutRequests.find(p => p.payout_type === "event" && ["requested", "pending_review", "approved"].includes(p.status));
  if (pending) return { eligible: false, nextDate: null, reason: "pending" };
  return { eligible: true, nextDate: null, reason: "ok" };
}

// Returns { eligible: bool, nextDate: Date|null, reason: string } for REFERRAL income
// Applies 14-day cooldown between referral payouts
function getReferralPayoutEligibility(payoutRequests) {
  const referralRequests = payoutRequests.filter(p => p.payout_type === "referral");
  const pending = referralRequests.find(p => ["requested", "pending_review", "approved"].includes(p.status));
  if (pending) return { eligible: false, nextDate: null, reason: "pending" };

  // Find best reference date: completed > approved > most recent request
  const completed = referralRequests.filter(p => p.status === "completed" && p.completed_date);
  const approved = referralRequests.filter(p => p.status === "approved" && p.approved_date);
  const allDates = [
    ...completed.map(p => new Date(p.completed_date)),
    ...approved.map(p => new Date(p.approved_date)),
    ...referralRequests.filter(p => p.request_date).map(p => new Date(p.request_date)),
  ].filter(d => !isNaN(d));

  if (allDates.length === 0) return { eligible: true, nextDate: null, reason: "first" };

  const lastDate = new Date(Math.max(...allDates));
  const nextDate = addDays(lastDate, PAYOUT_COOLDOWN_DAYS);
  const now = new Date();

  if (now >= nextDate) return { eligible: true, nextDate: null, reason: "ok" };
  return { eligible: false, nextDate, reason: "cooldown" };
}

function ExpandablePayoutHistory({ req, cfg, Icon }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/30 overflow-hidden text-xs">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${cfg.color.split(" ")[0]}`} />
          <span className="font-mono font-bold">${req.amount?.toFixed(2)}</span>
          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-mono">
            {req.completed_date ? format(new Date(req.completed_date), "MMM d, yyyy") : req.request_date ? format(new Date(req.request_date), "MMM d, yyyy") : "—"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <PayoutFeeBreakdown feeBreakdownJson={req.fee_breakdown} compact />
          {req.rejected_reason && (
            <p className="text-xs text-destructive font-mono mt-2">Rejected: {req.rejected_reason}</p>
          )}
          {req.admin_notes && (
            <p className="text-xs text-muted-foreground font-mono mt-1">Note: {req.admin_notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_CONFIG = {
  requested: { label: "Requested", color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  pending_review: { label: "Pending Review", color: "text-blue-400 bg-blue-400/10", icon: Clock },
  approved: { label: "Approved", color: "text-accent bg-accent/10", icon: CheckCircle },
  completed: { label: "Completed", color: "text-green-400 bg-green-400/10", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-destructive bg-destructive/10", icon: XCircle },
};

export default function OrganizerPayouts() {
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [feeSettings, setFeeSettings] = useState(null);
  const [bankInfo, setBankInfo] = useState(null);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch payout requests with auto-refresh every 5 seconds
  const loadPayoutRequests = async (organizerId) => {
    return await base44.entities.OrganizerPayoutRequest.filter({ organizer_id: organizerId }, "-created_date", 100).catch(() => []);
  };

  useEffect(() => {
    (async () => {
      // Call cleanup on load to ensure expired orders are updated
      await base44.functions.invoke('cleanupExpiredOrders', {}).catch(() => {});
      
      const me = await base44.auth.me();
      setUser(me);
      const [evs, fees, bankById, payouts] = await Promise.all([
        base44.entities.Event.filter({ organizer_id: me.id }, null, 200),
        base44.entities.OrganizerFeeSettings.filter({ organizer_id: me.id }, null, 1),
        base44.entities.OrganizerBankInfo.filter({ organizer_id: me.id }, null, 1).catch(() => []),
        loadPayoutRequests(me.id),
      ]);
      setEvents(evs);
      if (fees.length > 0) setFeeSettings(fees[0]);
      // Dual fallback: try organizer_id first, then organizer_email (handles legacy/mismatched records)
      let bank = bankById;
      if (bank.length === 0 && me.email) {
        bank = await base44.entities.OrganizerBankInfo.filter({ organizer_email: me.email }, null, 1).catch(() => []);
      }
      if (bank.length > 0) setBankInfo(bank[0]);
      setPayoutRequests(payouts);
      const ccFeeMap = Object.fromEntries(evs.map((e) => [e.id, e.cc_fee_on_buyer !== false]));
      const ords = await base44.entities.Order.filter({ organizer_id: me.id, status: "completed" }, "-created_date", 1000);
      setOrders(ords.map((o) => ({ ...o, _ccFeeOnBuyer: ccFeeMap[o.event_id] ?? true })));
      setLoading(false);
    })();
  }, []);

  // Auto-refresh payout status every 5 seconds
  useEffect(() => {
    if (!user?.id) return;

    const refreshPayouts = async () => {
      const updated = await loadPayoutRequests(user.id);
      setPayoutRequests(updated);
    };

    const interval = setInterval(refreshPayouts, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const feePct = feeSettings?.platform_fee_pct ?? 10;
  const feeFixed = feeSettings?.platform_fee_fixed ?? 0;

  // Helper: calculate revenue for a specific event using STORED fee values only
  const getEventRevenue = (eventId) => {
    const eventOrders = orders.filter(o => o.event_id === eventId);
    const gross = eventOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
    const platformFees = eventOrders.reduce((s, o) => s + (o.service_fee || 0), 0);

    // Use stored card_processing_fee when available.
    // Only deduct it from organizer net when organizer is responsible (cc_fee_paid_by === 'organizer').
    // For legacy orders without stored field: fall back to 3% estimate only when organizer absorbs it
    // (identified by _ccFeeOnBuyer === false).
    const cardFees = eventOrders.reduce((s, o) => {
      if (o.card_processing_fee != null) {
        // New orders: use stored value, deduct only if organizer pays
        return s + (o.cc_fee_paid_by === 'organizer' ? (o.card_processing_fee || 0) : 0);
      }
      // Legacy orders: estimate only when organizer absorbs fee
      if (o._ccFeeOnBuyer !== false) return s;
      const base = (o.subtotal || 0) + (o.service_fee || 0);
      return s + base * 0.03;
    }, 0);

    return {
      gross,
      serviceFees: platformFees,
      cardFees,
      // Net = gross ticket sales minus platform fee minus any card fee the organizer absorbs
      net: gross - platformFees - cardFees,
    };
  };

  // Separate event and referral payouts
  const eventPayoutRequests = payoutRequests.filter(p => p.payout_type !== "referral" || !p.payout_type);
  
  // Build per-event payout summary
  const eventPayoutSummaries = events.map(event => {
    const revenue = getEventRevenue(event.id);
    const eventPayouts = eventPayoutRequests.filter(p => p.event_id === event.id);
    const completedPayouts = eventPayouts.filter(p => p.status === "completed");
    const pendingPayouts = eventPayouts.filter(p => ["requested", "pending_review", "approved"].includes(p.status));
    
    const alreadyPaidOut = completedPayouts.reduce((s, p) => s + (p.amount || 0), 0);
    const pendingAmount = pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0);
    const availablePayout = Math.max(0, revenue.net - alreadyPaidOut - pendingAmount);
    
    return {
      event,
      revenue,
      completedPayouts,
      pendingPayouts,
      pendingRequest: pendingPayouts[0] || null,
      alreadyPaidOut,
      pendingAmount,
      availablePayout,
      eligibility: getEventPayoutEligibility(eventPayouts),
    };
  }).filter(s => s.revenue.gross > 0); // Only show events with revenue

  const handleRequestPayout = async (summary) => {
    if (!bankInfo) { toast.error("Please add bank information first."); return; }
    if (summary.availablePayout <= 0) { toast.error("No balance available to request."); return; }
    if (!summary.eligibility.eligible) { toast.error("Not yet eligible for payout."); return; }

    setSending(true);
    const now = new Date().toISOString();

    const newRequest = await base44.entities.OrganizerPayoutRequest.create({
      organizer_id: user.id,
      organizer_email: user.email,
      organizer_name: user.full_name,
      event_id: summary.event.id,
      event_title: summary.event.title,
      amount: summary.availablePayout,
      bank_info_id: bankInfo.id,
      bank_snapshot: JSON.stringify({
        account_holder_name: bankInfo.account_holder_name,
        bank_name: bankInfo.bank_name,
        account_type: bankInfo.account_type,
        account_number_last4: bankInfo.account_number?.slice(-4),
        routing_number_last4: bankInfo.routing_number?.slice(-4),
      }),
      fee_breakdown: JSON.stringify({
        gross_ticket_sales: summary.revenue.gross,
        gross_table_sales: 0,
        platform_fee_deducted: summary.revenue.serviceFees,
        cc_fee_deducted: summary.revenue.cardFees,
        already_paid_out: summary.alreadyPaidOut,
        pending_amount: summary.pendingAmount,
        net_payout: summary.availablePayout,
      }),
      payout_type: "event",
      status: "pending_review",
      request_date: now,
    });
    setPayoutRequests(prev => [newRequest, ...prev]);

    // Admin notifications — check for duplicates first
    const adminUsers = await base44.entities.User.list(null, 200).catch(() => []);
    const admins = adminUsers.filter((u) => u.role === "admin");
    const notifTitle = `💸 Payout Request: ${user.full_name} — ${summary.event.title}`;

    await Promise.all(admins.map(async admin => {
      // Duplicate check
      const existing = await base44.entities.Notification.filter({ user_email: admin.email, title: notifTitle }, null, 5).catch(() => []);
      const alreadySent = existing.some(n => n.message?.includes(newRequest.id));
      if (!alreadySent) {
        await base44.entities.Notification.create({
          user_email: admin.email,
          title: notifTitle,
          message: `New payout request submitted by ${user.full_name} for event "${summary.event.title}" ($${summary.availablePayout.toFixed(2)}). Request ID: ${newRequest.id}. Requested: ${format(new Date(now), "MMM d, yyyy")}.`,
          type: "general",
          link: "/admin/payouts",
        }).catch(() => {});
      }
      await sendEmail({
        _source: "OrganizerPayouts/request",
        to: admin.email,
        subject: `💸 Payout Request from ${user.full_name} — ${summary.event.title}`,
        body: buildEmailBody({
          title: "Payout Request 💸",
          greeting: `Hello ${admin.full_name || "Admin"},`,
          message: `<strong>${user.full_name}</strong> (${user.email}) has submitted a payout request for event <strong>${summary.event.title}</strong>.`,
          infoBox: { highlight: true, rows: [
            { label: "Event", value: summary.event.title },
            { label: "Available Payout", value: `$${summary.availablePayout.toFixed(2)}` },
            { label: "Bank", value: bankInfo.bank_name },
            { label: "Account (last 4)", value: `••••${bankInfo.account_number?.slice(-4)}` },
            { label: "Status", value: "Pending Review" },
            { label: "Request ID", value: newRequest.id },
          ]},
          extraLines: ["Please log into the admin panel to review and approve this request."],
        }),
      }).catch(() => {});
    }));

    toast.success(`Payout request for "${summary.event.title}" has been submitted for admin review.`);
    setSending(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const totalAvailablePayout = eventPayoutSummaries.reduce((s, p) => s + p.availablePayout, 0);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">Revenue</span>
        <h1 className="font-display font-black text-3xl tracking-tight mt-1">PAYOUTS</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">{orders.length} completed orders across {eventPayoutSummaries.length} events</p>
      </div>

      {/* ── Total Available Payout Hero Card ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30">
        <div className="flex items-center gap-3 mb-1">
          <Wallet className="w-6 h-6 text-primary" />
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Total Available (All Events)</span>
        </div>
        <div className="text-4xl font-display font-black text-primary mt-1">
          ${totalAvailablePayout.toFixed(2)}
        </div>
      </div>

      {feeSettings && (
        <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 font-mono text-xs">
          <span className="text-accent font-bold">Custom fee rate applied: </span>
          {feePct}% platform fee + ${feeFixed.toFixed(2)}/ticket fixed fee
        </div>
      )}

      {/* Bank Info Alert */}
      {!bankInfo && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-yellow-400">Bank information required before payout can be requested</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add your bank details in your profile to enable payout requests.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
            <Link to="/organizer/profile"><Building className="w-3.5 h-3.5" /> Add Bank Info</Link>
          </Button>
        </div>
      )}

      {/* Per-Event Payout Cards */}
      <div className="space-y-6">
        {eventPayoutSummaries.length === 0 ? (
          <div className="p-6 rounded-xl bg-card border border-border/50 text-center">
            <p className="text-muted-foreground font-mono">No events with completed orders yet.</p>
          </div>
        ) : (
          eventPayoutSummaries.map(summary => (
            <div key={summary.event.id} className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
              {/* Event Title & Availability */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-display font-bold text-lg">{summary.event.title}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {summary.event.date ? format(new Date(summary.event.date), "MMM d, yyyy 'at' h:mm a") : "TBA"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-muted-foreground">Available for this event</p>
                  <p className="font-display font-black text-2xl text-primary">${summary.availablePayout.toFixed(2)}</p>
                </div>
              </div>

              {/* Fee Breakdown for this Event */}
              <div className="space-y-2 p-4 rounded-lg bg-secondary/30 border border-border/30">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Gross Ticket Sales</span>
                  <span className="font-bold">${summary.revenue.gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Platform Fee Deduction</span>
                  <span className="text-destructive">-${summary.revenue.serviceFees.toFixed(2)}</span>
                </div>
                {summary.revenue.cardFees > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Card Processing Fee (absorbed by you)</span>
                    <span className="text-destructive">-${summary.revenue.cardFees.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-mono pt-1 border-t border-border/30">
                  <span className="text-muted-foreground font-bold">Your Net Earnings</span>
                  <span className="font-bold text-foreground">${summary.revenue.net.toFixed(2)}</span>
                </div>
                {summary.alreadyPaidOut > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Already paid out</span>
                    <span className="text-muted-foreground">-${summary.alreadyPaidOut.toFixed(2)}</span>
                  </div>
                )}
                {summary.pendingAmount > 0 && (
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Pending payout request</span>
                    <span className="text-yellow-400">-${summary.pendingAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-border/50">
                  <span>Available for Payout</span>
                  <span className="text-primary">${summary.availablePayout.toFixed(2)}</span>
                </div>
              </div>

              {/* Status & Action */}
              {summary.pendingRequest && (() => {
                const s = summary.pendingRequest.status;
                const isApproved = s === "approved";
                const isPending = s === "pending_review" || s === "requested";
                const color = isApproved ? "text-accent" : "text-blue-400";
                const bg = isApproved ? "bg-accent/10 border-accent/20" : "bg-blue-400/10 border-blue-400/20";
                const title = isApproved ? "✅ Approved — Payout on the way" : "🕐 Pending Review";
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${bg}`}>
                    {isApproved ? <CheckCircle className={`w-4 h-4 shrink-0 ${color}`} /> : <Clock className={`w-4 h-4 shrink-0 ${color}`} />}
                    <div className="flex-1">
                      <p className={`font-bold ${color}`}>{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">${summary.pendingRequest.amount?.toFixed(2)} · Requested {format(new Date(summary.pendingRequest.request_date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                );
              })()}

              {!summary.pendingRequest && (
                <Button
                  onClick={() => handleRequestPayout(summary)}
                  disabled={sending || !bankInfo || summary.availablePayout <= 0 || !summary.eligibility.eligible}
                  className="w-full glow-lime font-display font-bold gap-2"
                >
                  <Send className="w-4 h-4" />
                  {!bankInfo ? "Add Bank Info First" : sending ? "Submitting..." : `Request $${summary.availablePayout.toFixed(2)} Payout`}
                </Button>
              )}

              {/* Completed Payouts for this Event */}
              {summary.completedPayouts.length > 0 && (
                <div className="pt-4 border-t border-border/30 space-y-2">
                  <p className="text-xs font-mono font-bold uppercase text-muted-foreground">Payout History</p>
                  {summary.completedPayouts.map(req => {
                    const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.requested;
                    const Icon = cfg.icon;
                    return (
                      <ExpandablePayoutHistory key={req.id} req={req} cfg={cfg} Icon={Icon} />
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}