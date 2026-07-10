import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw, ShoppingCart, ShieldCheck, DollarSign, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS = {
  available: "text-accent",
  used: "text-green-400",
  pending_payment: "text-yellow-400",
  payment_failed: "text-destructive",
  refunded: "text-muted-foreground",
};

const SESSION_STATUS_COLORS = {
  open: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  partially_paid: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  paid: "text-green-400 bg-green-400/10 border-green-400/30",
};

export default function AIFlyerAnalytics() {
  const [credits, setCredits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [acks, setAcks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [detailModal, setDetailModal] = useState(null);

  const load = async () => {
    setLoading(true);
    const [c, s, a] = await Promise.all([
      base44.entities.AIFlyerCredit.list("-created_date", 500).catch(() => []),
      base44.entities.AIFlyerSession.list("-created_date", 200).catch(() => []),
      base44.entities.AIFlyerAcknowledgement.list("-created_date", 200).catch(() => []),
    ]);
    setCredits(c);
    setSessions(s);
    setAcks(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMarkSettled = async (sessionId, organizerEmail) => {
    setSettlingId(sessionId || organizerEmail);
    await base44.functions.invoke("aiFlyerPayment", {
      action: "admin_mark_settled",
      organizerEmail,
      sessionId,
    }).catch(() => {});
    toast.success("Balance marked as settled.");
    await load();
    setSettlingId(null);
  };

  // Summary stats
  const freeGenerations = credits.filter(c => c.type === "free" && c.status === "used").length;
  const paidGenerations = credits.filter(c => c.type === "paid" && c.status === "used").length;
  const openSessions = sessions.filter(s => s.status === "open" || s.status === "partially_paid");
  const pendingAmount = openSessions.reduce((sum, s) => sum + (s.pending_amount || 0), 0);
  const pendingCount = openSessions.reduce((sum, s) => sum + (s.pending_count || 0), 0);
  const paidAmount = sessions.filter(s => s.status === "paid").reduce((sum, s) => sum + (s.paid_amount || 0), 0);
  const estimatedCost = (freeGenerations + paidGenerations) * 0.40;
  const netIncome = paidAmount - estimatedCost;

  // Organizer breakdown — group by email, compute pending + collected
  const byOrganizer = {};
  credits.forEach(c => {
    const k = c.organizer_email || "unknown";
    if (!byOrganizer[k]) byOrganizer[k] = { email: k, free: 0, paid: 0, total: 0, collected: 0, pendingAmount: 0, pendingCount: 0 };
    if (c.status === "used") {
      byOrganizer[k].total++;
      if (c.type === "free") byOrganizer[k].free++;
      if (c.type === "paid") { byOrganizer[k].paid++; byOrganizer[k].collected += c.amount_paid || 0; }
    }
  });
  openSessions.forEach(s => {
    const k = s.organizer_email || "unknown";
    if (!byOrganizer[k]) byOrganizer[k] = { email: k, free: 0, paid: 0, total: 0, collected: 0, pendingAmount: 0, pendingCount: 0 };
    byOrganizer[k].pendingAmount += s.pending_amount || 0;
    byOrganizer[k].pendingCount += s.pending_count || 0;
  });
  const organizerRows = Object.values(byOrganizer).sort((a, b) => b.pendingAmount - a.pendingAmount || b.total - a.total).slice(0, 30);

  const summaryCards = [
    { label: "Pending Payout Deductions", value: `$${pendingAmount.toFixed(2)}`, sub: `${pendingCount} generation${pendingCount !== 1 ? "s" : ""}`, color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
    { label: "Total Settled/Collected", value: `$${paidAmount.toFixed(2)}`, color: "text-primary border-primary/30 bg-primary/10" },
    { label: "Estimated AI Cost", value: `$${estimatedCost.toFixed(2)}`, color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
    { label: "Net Income", value: `$${netIncome.toFixed(2)}`, color: netIncome >= 0 ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-destructive border-destructive/30 bg-destructive/10" },
    { label: "Paid Generations", value: paidGenerations, color: "text-accent border-accent/30 bg-accent/10" },
    { label: "Free Generations", value: freeGenerations, color: "text-muted-foreground border-border/50 bg-card" },
    { label: "Total Generated", value: freeGenerations + paidGenerations, color: "text-foreground border-border/50 bg-card" },
    { label: "E-Sign Records", value: acks.length, color: "text-green-400 border-green-400/30 bg-green-400/10" },
  ];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "pending", label: `Pending Bills (${openSessions.length})` },
    { id: "acks", label: `Acceptances (${acks.length})` },
    { id: "sessions", label: "All Sessions" },
    { id: "credits", label: "Credit Log" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-black text-xl tracking-tight leading-tight">AI FLYER BILLING</h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5 leading-relaxed">Pending payout deductions · acceptance records · usage</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => {
          const isClickable = i === 0 || i === 6 || i === 7;
          const Comp = isClickable ? "button" : "div";
          const props = isClickable ? { onClick: () => setDetailModal(i) } : {};
          return (
            <Comp
              key={i}
              {...props}
              className={`p-3 sm:p-4 rounded-xl border ${card.color} text-left ${isClickable ? "cursor-pointer hover:opacity-80 active:scale-95" : ""} transition-all overflow-hidden`}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 leading-tight">{card.label}</p>
              <p className="font-display font-black text-xl sm:text-2xl leading-none tabular-nums truncate">{card.value}</p>
              {card.sub && <p className="text-[10px] font-mono text-muted-foreground mt-1">{card.sub}</p>}
            </Comp>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border/50 pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-mono font-bold rounded-t-lg border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview — organizer-level summary */}
      {activeTab === "overview" && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <h3 className="font-display font-bold text-sm mb-3 uppercase tracking-wider">Organizer Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left border-b border-border/50">
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Organizer</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Free</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Paid</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Settled</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Pending Bill</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {organizerRows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-mono text-xs truncate max-w-[180px]">{row.email}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.free}</td>
                    <td className="py-2 pr-4 text-accent font-bold">{row.paid}</td>
                    <td className="py-2 pr-4 text-primary font-bold">${row.collected.toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      {row.pendingAmount > 0 ? (
                        <span className="text-yellow-400 font-bold">${row.pendingAmount.toFixed(2)} ({row.pendingCount} gen)</span>
                      ) : (
                        <span className="text-green-400 text-xs">✓ Clear</span>
                      )}
                    </td>
                    <td className="py-2">
                      {row.pendingAmount > 0 && (
                        <button
                          onClick={() => handleMarkSettled(null, row.email)}
                          disabled={settlingId === row.email}
                          className="text-xs font-mono text-primary hover:underline disabled:opacity-50"
                        >
                          {settlingId === row.email ? "Settling…" : "Mark Settled"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Bills */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {openSessions.length === 0 ? (
            <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending AI flyer bills. All clear!</p>
            </div>
          ) : openSessions.map((s, i) => (
            <div key={i} className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-xs text-yellow-400 font-bold truncate">{s.organizer_email || "—"}</p>
                <p className="text-xs text-muted-foreground font-mono">Event ID: {s.event_id || "—"}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${SESSION_STATUS_COLORS[s.status] || "text-muted-foreground"}`}>
                    {s.status?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-yellow-400 font-bold">{s.pending_count} gen · ${(s.pending_amount || 0).toFixed(2)}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{s.created_date ? format(new Date(s.created_date), "MMM d, yy") : "—"}</span>
                </div>
              </div>
              <button
                onClick={() => handleMarkSettled(s.id, s.organizer_email)}
                disabled={settlingId === s.id}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20 text-green-400 text-xs font-mono font-bold hover:bg-green-400/20 transition-colors disabled:opacity-50"
              >
                {settlingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                {settlingId === s.id ? "Settling…" : "Mark Settled"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Acceptance / E-Sign Records */}
      {activeTab === "acks" && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Digital Acceptance Records</h3>
            <span className="text-xs font-mono text-muted-foreground ml-auto">{acks.length} records</span>
          </div>
          {acks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No acceptance records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left border-b border-border/50">
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Date & Time</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Organizer</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Event ID</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Terms Ver</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-4">Checkbox</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {acks.slice(0, 100).map((a, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {a.accepted_at ? format(new Date(a.accepted_at), "MMM d, yy HH:mm") : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <p className="font-mono text-xs truncate max-w-[160px]">{a.organizer_email || "—"}</p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">{a.organizer_name || ""}</p>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground truncate max-w-[100px]">{a.event_id || "—"}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{a.terms_version || "v1"}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs font-mono font-bold text-green-400">✓ CHECKED</span>
                      </td>
                      <td className="py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{a.user_agent ? a.user_agent.slice(0, 60) + "…" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {acks.length > 100 && <p className="text-xs text-muted-foreground font-mono mt-3 text-center">Showing 100 of {acks.length}</p>}
            </div>
          )}
        </div>
      )}

      {/* All Sessions */}
      {activeTab === "sessions" && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <h3 className="font-display font-bold text-sm mb-3 uppercase tracking-wider">All Billing Sessions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-border/50">
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Date</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Organizer</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Event</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Status</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Pending</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Paid</th>
                  <th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Settled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sessions.slice(0, 100).map((s, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{s.created_date ? format(new Date(s.created_date), "MMM d, yy") : "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs truncate max-w-[150px]">{s.organizer_email || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs truncate max-w-[100px] text-muted-foreground">{s.event_id || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${SESSION_STATUS_COLORS[s.status] || "text-muted-foreground border-border"}`}>
                        {s.status?.toUpperCase() || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-yellow-400 font-bold">{s.pending_count > 0 ? `${s.pending_count} · $${(s.pending_amount||0).toFixed(2)}` : "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-green-400 font-bold">{s.paid_count > 0 ? `${s.paid_count} · $${(s.paid_amount||0).toFixed(2)}` : "—"}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{s.paid_at ? format(new Date(s.paid_at), "MMM d, yy") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Transaction Log */}
      {activeTab === "credits" && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <h3 className="font-display font-bold text-sm mb-3 uppercase tracking-wider">Credit Transaction Log</h3>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : credits.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No AI flyer transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left border-b border-border/50">
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Date</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Organizer</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Event</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Type</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase pr-3">Amount</th>
                    <th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {credits.slice(0, 100).map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{c.created_date ? format(new Date(c.created_date), "MMM d, yy HH:mm") : "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs truncate max-w-[150px]">{c.organizer_email || "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs truncate max-w-[100px] text-muted-foreground">{c.event_id || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${c.type === "free" ? "bg-muted/50 text-muted-foreground" : "bg-accent/10 text-accent"}`}>
                          {c.type === "free" ? "FREE" : "PAID"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs font-bold">{c.amount_paid ? `$${Number(c.amount_paid).toFixed(2)}` : "$0.00"}</td>
                      <td className={`py-2 text-xs font-mono font-bold ${STATUS_COLORS[c.status] || "text-muted-foreground"}`}>
                        {c.status?.replace(/_/g, " ").toUpperCase() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {credits.length > 100 && <p className="text-xs text-muted-foreground font-mono mt-3 text-center">Showing 100 of {credits.length}</p>}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailModal !== null && (
       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
         <div className="bg-card border border-border/50 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
           <div className="sticky top-0 bg-card border-b border-border/30 p-4 flex items-center justify-between">
             <h3 className="font-display font-bold text-lg">{summaryCards[detailModal].label}</h3>
             <button
               onClick={() => setDetailModal(null)}
               className="text-muted-foreground hover:text-foreground transition-colors"
             >
               ✕
             </button>
           </div>
           <div className="p-6 space-y-4">
             {detailModal === 0 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">Pending payouts from {openSessions.length} active session{openSessions.length !== 1 ? "s" : ""}:</p>
                 <div className="space-y-2 max-h-96 overflow-y-auto">
                   {openSessions.map((s, i) => (
                     <div key={i} className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                       <p className="font-mono text-xs font-bold text-yellow-400">{s.organizer_email}</p>
                       <p className="text-xs text-muted-foreground mt-1">Event: {s.event_id || "—"} · {s.pending_count} gen · ${(s.pending_amount || 0).toFixed(2)}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             {detailModal === 1 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">{sessions.filter(s => s.status === "paid").length} settled session{sessions.filter(s => s.status === "paid").length !== 1 ? "s" : ""}:</p>
                 <div className="space-y-2 max-h-96 overflow-y-auto">
                   {sessions.filter(s => s.status === "paid").map((s, i) => (
                     <div key={i} className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                       <p className="font-mono text-xs font-bold text-green-400">{s.organizer_email}</p>
                       <p className="text-xs text-muted-foreground mt-1">Paid: ${(s.paid_amount || 0).toFixed(2)} · Settled: {s.paid_at ? new Date(s.paid_at).toLocaleDateString() : "—"}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             {detailModal === 2 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">Estimated cost: ${estimatedCost.toFixed(2)} ({freeGenerations + paidGenerations} generations × $0.40)</p>
                 <div className="bg-secondary/50 rounded-lg border border-border/30 p-4">
                   <p className="text-xs text-muted-foreground">Free: {freeGenerations} gen</p>
                   <p className="text-xs text-muted-foreground mt-1">Paid: {paidGenerations} gen</p>
                 </div>
               </div>
             )}
             {detailModal === 3 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">Revenue minus estimated AI costs</p>
                 <div className="bg-secondary/50 rounded-lg border border-border/30 p-4">
                   <p className="text-xs">Collected: ${paidAmount.toFixed(2)}</p>
                   <p className="text-xs text-muted-foreground mt-1">— Est. Cost: ${estimatedCost.toFixed(2)}</p>
                   <p className="text-xs font-bold mt-2 border-t border-border/30 pt-2">=  ${netIncome.toFixed(2)}</p>
                 </div>
               </div>
             )}
             {detailModal === 4 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">{paidGenerations} paid generations used by organizers</p>
               </div>
             )}
             {detailModal === 5 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">{freeGenerations} free first-generation credits used</p>
               </div>
             )}
             {detailModal === 6 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">Total generations breakdown:</p>
                 <div className="space-y-2">
                   <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                     <p className="text-xs text-muted-foreground">Free Generations</p>
                     <p className="font-display font-black text-xl mt-1">{freeGenerations}</p>
                   </div>
                   <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                     <p className="text-xs text-muted-foreground">Paid Generations</p>
                     <p className="font-display font-black text-xl mt-1 text-accent">{paidGenerations}</p>
                   </div>
                   <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                     <p className="text-xs text-muted-foreground">Combined Total</p>
                     <p className="font-display font-black text-xl mt-1 text-primary">{freeGenerations + paidGenerations}</p>
                   </div>
                 </div>
               </div>
             )}
             {detailModal === 7 && (
               <div className="space-y-3">
                 <p className="text-sm text-muted-foreground">{acks.length} e-signed acceptance records:</p>
                 <div className="space-y-2 max-h-96 overflow-y-auto">
                   {acks.slice(0, 20).map((a, i) => (
                     <div key={i} className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                       <p className="font-mono text-xs font-bold text-green-400">{a.organizer_email || "—"}</p>
                       <p className="text-xs text-muted-foreground mt-1">
                         {a.accepted_at ? new Date(a.accepted_at).toLocaleDateString() : "—"} · Terms: {a.terms_version || "v1"}
                       </p>
                     </div>
                   ))}
                 </div>
                 {acks.length > 20 && <p className="text-xs text-muted-foreground font-mono text-center">Showing 20 of {acks.length}</p>}
               </div>
             )}
           </div>
         </div>
       </div>
      )}
      </div>
      );
      }