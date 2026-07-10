import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, CheckCircle, XCircle, Clock, AlertCircle, User, ChevronDown, ExternalLink, Eye, Shield, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import PayoutFeeBreakdown from "../../components/organizer/PayoutFeeBreakdown";
import ResalePayoutManager from "../../components/admin/ResalePayoutManager";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";

const ORG_STATUS_CONFIG = {
  requested:     { label: "Requested",     color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  pending_review:{ label: "Pending Review",color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  approved:      { label: "Approved",      color: "text-accent bg-accent/10 border-accent/20",           icon: CheckCircle },
  completed:     { label: "Completed",     color: "text-green-400 bg-green-400/10 border-green-400/20", icon: CheckCircle },
  rejected:      { label: "Rejected",      color: "text-destructive bg-destructive/10 border-destructive/20", icon: XCircle },
};

const ARTIST_STATUS_CONFIG = {
  pending:    { label: "Pending Review", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  processing: { label: "Processing",    color: "text-accent bg-accent/10 border-accent/20",             icon: AlertCircle },
  completed:  { label: "Completed",     color: "text-green-400 bg-green-400/10 border-green-400/20",   icon: CheckCircle },
  rejected:   { label: "Rejected",      color: "text-destructive bg-destructive/10 border-destructive/20", icon: XCircle },
};

export default function AdminPayouts() {
  const [orgRequests, setOrgRequests] = useState([]);
  const [artistRequests, setArtistRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState("all");
  const [roleTab, setRoleTab] = useState("organizer");
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewBankData, setReviewBankData] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setAdmin(me);
      const [reqs, artistPayouts] = await Promise.all([
        base44.entities.OrganizerPayoutRequest.list("-created_date", 200).catch(() => []),
        base44.entities.ArtistPayout.list("-created_date", 200).catch(() => []),
      ]);
      setOrgRequests(reqs);
      setArtistRequests(artistPayouts);
      setLoading(false);
    })();
  }, []);

  // ── Organizer payout actions ──
  const updateOrgStatus = async (req, status) => {
    setProcessing(req.id);
    const now = new Date().toISOString();
    const update = { status, reviewed_by: admin?.email, reviewed_date: now };
    if (status === "approved") update.approved_date = now;
    if (status === "completed") update.completed_date = now;
    if (status === "rejected") update.rejected_reason = rejectReason;

    await base44.entities.OrganizerPayoutRequest.update(req.id, update);
    setOrgRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...update } : r));

    await base44.entities.Notification.create({
      user_email: req.organizer_email,
      title: status === "completed" ? `✅ Payout Completed` : status === "approved" ? `✅ Payout Approved` : `❌ Payout Rejected`,
      message: status === "completed"
        ? `Your payout request has been completed. Your payout is on the way.`
        : status === "approved"
        ? `Your payout request has been approved. Your payout is on the way.`
        : `Your payout was rejected. Please contact us.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
      type: "general",
      link: "/organizer/payouts",
    }).catch(() => {});

    if (req.organizer_email) {
      await sendEmail({
        _source: "AdminPayouts/update",
        to: req.organizer_email,
        subject: status === "completed" ? `✅ Payout Completed - $${req.amount?.toFixed(2)}` : status === "approved" ? `✅ Payout Approved` : `❌ Payout Request Update`,
        body: buildEmailBody({
          title: status === "completed" ? "Payout Completed ✅" : status === "approved" ? "Payout Approved ✅" : "Payout Request Update",
          greeting: `Hi ${req.organizer_name || "there"},`,
          message: status === "completed"
            ? `Your payout of <strong>$${req.amount?.toFixed(2)}</strong> has been completed.`
            : status === "approved"
            ? `Your payout of <strong>$${req.amount?.toFixed(2)}</strong> has been approved and is being processed.`
            : `Your payout request was not approved.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
          infoBox: { highlight: true, rows: [
            { label: "Amount", value: `$${req.amount?.toFixed(2)}` },
            { label: "Status", value: ORG_STATUS_CONFIG[status]?.label || status },
            { label: "Date", value: format(new Date(), "MMM d, yyyy") },
          ]},
        }),
      }).catch(() => {});
    }

    // On approval: fetch full bank details and email admin for payout processing
    if (status === "approved" && admin?.email) {
      try {
        const bankRes = await base44.functions.invoke("fetchOrganizerBankInfo", {
          organizer_id: req.organizer_id,
        });
        const bankInfo = bankRes.data?.bank_info;

        const bankRows = [
          { label: "Organizer", value: `${req.organizer_name || "—"} (${req.organizer_email})` },
          { label: "Amount", value: `$${req.amount?.toFixed(2)}` },
          { label: "Request ID", value: req.id },
          { label: "Approved", value: format(new Date(), "MMM d, yyyy 'at' h:mm a") },
          { label: "Event", value: req.event_title || "—" },
        ];

        if (bankInfo) {
          bankRows.push(
            { label: "Account Holder", value: bankInfo.account_holder_name || "—" },
            { label: "Bank", value: bankInfo.bank_name || "—" },
            { label: "Account Number", value: bankInfo.account_number || "—" },
            { label: "Routing Number", value: bankInfo.routing_number || "—" },
            { label: "Account Type", value: bankInfo.account_type || "—" },
            { label: "Country", value: bankInfo.country || "—" },
          );
          if (bankInfo.swift_code) bankRows.push({ label: "SWIFT", value: bankInfo.swift_code });
          if (bankInfo.iban) bankRows.push({ label: "IBAN", value: bankInfo.iban });
          if (bankInfo.bank_address) bankRows.push({ label: "Bank Address", value: bankInfo.bank_address });
        }

        await sendEmail({
          _source: "AdminPayouts/adminApproval",
          to: admin.email,
          subject: `🔐 Payout Approved — Action Required: $${req.amount?.toFixed(2)} to ${req.organizer_name}`,
          body: buildEmailBody({
            title: "Payout Approved — Processing Required 🔐",
            greeting: null,
            message: `A payout has been approved. Please process the transfer using the bank details below. <strong>These details are not visible in the dashboard for security purposes.</strong>`,
            infoBox: { highlight: true, rows: bankRows },
            extraLines: [
              `<strong style="color:#ff1b8d;">⚠️ Security Notice:</strong> This email contains sensitive bank information. Please process the payout and delete or archive this email immediately after completion.`,
            ],
            footerNote: "This is an automated security notification — do not forward.",
          }),
        }).catch(() => {});
      } catch (e) {
        console.error("Failed to send admin payout notification:", e);
      }
    }

    setProcessing(null);
    setRejectingId(null);
    setRejectReason("");
    toast.success(`Payout ${status}`);
  };

  // ── Artist payout actions ──
  const updateArtistStatus = async (req, status) => {
    setProcessing(req.id);
    const now = new Date().toISOString();
    const update = { status };
    if (status === "completed") update.processed_at = now;
    if (status === "rejected" && rejectReason) update.admin_note = rejectReason;

    await base44.entities.ArtistPayout.update(req.id, update);
    setArtistRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...update } : r));

    await base44.entities.Notification.create({
      user_email: req.artist_email,
      title: status === "completed" ? `✅ Payout Completed` : status === "processing" ? `✅ Payout Approved` : `❌ Payout Rejected`,
      message: status === "completed"
        ? `Your payout request has been completed. Your payout is on the way.`
        : status === "processing"
        ? `Your payout request has been approved. Your payout is on the way.`
        : `Your payout was rejected. Please contact us.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
      type: "general",
      link: "/artist/payouts",
    }).catch(() => {});

    setProcessing(null);
    setRejectingId(null);
    setRejectReason("");
    toast.success(`Artist payout ${status}`);
  };

  const pendingOrg = orgRequests.filter(r => ["requested", "pending_review"].includes(r.status));
  const pendingArtist = artistRequests.filter(r => r.status === "pending");
  const totalPending = pendingOrg.length + pendingArtist.length;

  const filteredOrg = filter === "all" ? orgRequests : orgRequests.filter(r => r.status === filter);
  const filteredArtist = filter === "all" ? artistRequests : artistRequests.filter(r => r.status === filter);

  const [showResalePayout, setShowResalePayout] = useState(false);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">PAYOUT REQUESTS</h1>
        <p className="text-sm text-muted-foreground mt-1">{orgRequests.length + artistRequests.length} total · {totalPending} pending review</p>
      </div>

      {/* Resale Payout Section Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowResalePayout(false)}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
            !showResalePayout
              ? "bg-primary text-primary-foreground"
              : "bg-secondary border border-border/50 text-muted-foreground hover:border-primary/40"
          }`}
        >
          Organizer & Artist
        </button>
        <button
          onClick={() => setShowResalePayout(true)}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
            showResalePayout
              ? "bg-primary text-primary-foreground"
              : "bg-secondary border border-border/50 text-muted-foreground hover:border-primary/40"
          }`}
        >
          Fan Resale Payouts
        </button>
      </div>

      {showResalePayout && <ResalePayoutManager />}

      {!showResalePayout && totalPending > 0 && (
        <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400 font-bold">{totalPending} payout request{totalPending !== 1 ? "s" : ""} pending your review</p>
        </div>
      )}

      {/* Role tab */}
      {!showResalePayout && (
      <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
        {[{ key: "organizer", label: `Organizers (${orgRequests.length})` }, { key: "artist", label: `Artists (${artistRequests.length})` }].map(t => (
          <button key={t.key} onClick={() => { setRoleTab(t.key); setFilter("all"); }}
            className={`px-4 py-2 text-xs font-mono font-bold transition-all ${roleTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* Status filter */}
      {!showResalePayout && (
      <div className="flex flex-wrap gap-2">
        {roleTab === "organizer"
          ? ["all", "requested", "pending_review", "approved", "completed", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}>
              {s === "all" ? "All" : ORG_STATUS_CONFIG[s]?.label || s}
            </button>
          ))
          : ["all", "pending", "processing", "completed", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}>
              {s === "all" ? "All" : ARTIST_STATUS_CONFIG[s]?.label || s}
            </button>
          ))
        }
      </div>
      )}

      {/* ── Organizer requests ── */}
      {!showResalePayout && roleTab === "organizer" && (
        filteredOrg.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 font-mono text-sm">No organizer payout requests found</p>
        ) : (
          <div className="space-y-4">
            {filteredOrg.map(req => {
              const cfg = ORG_STATUS_CONFIG[req.status] || ORG_STATUS_CONFIG.requested;
              const Icon = cfg.icon;
              return (
                <div key={req.id} className={`p-5 rounded-xl bg-card border ${["requested","pending_review"].includes(req.status) ? "border-yellow-400/20" : "border-border/50"} space-y-4`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <p className="font-display font-bold">{req.organizer_name || req.organizer_email}</p>
                        <span className="text-[10px] font-mono font-bold bg-accent/10 text-accent px-2 py-0.5 rounded uppercase">Organizer</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{req.organizer_email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested: {req.request_date ? format(new Date(req.request_date), "MMM d, yyyy 'at' h:mm a") : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-primary text-xl">${req.amount?.toFixed(2)}</p>
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 mt-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Event info */}
                  {req.event_title && (
                    <p className="text-xs text-muted-foreground font-mono">📅 Event: <span className="text-foreground font-bold">{req.event_title}</span></p>
                  )}
                  {req.completed_date && <p className="text-xs text-green-400 font-mono">✅ Completed: {format(new Date(req.completed_date), "MMM d, yyyy")}</p>}
                  {req.rejected_reason && <p className="text-xs text-destructive font-mono">Rejection: {req.rejected_reason}</p>}
                  {req.reviewed_by && <p className="text-xs text-muted-foreground font-mono">Reviewed by: {req.reviewed_by}</p>}

                  {/* Fee breakdown audit trail */}
                  {req.fee_breakdown && (
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground cursor-pointer list-none hover:text-foreground transition-colors py-1 select-none">
                        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                        Fee &amp; Deduction Breakdown
                      </summary>
                      <div className="mt-2">
                        <PayoutFeeBreakdown feeBreakdownJson={req.fee_breakdown} />
                      </div>
                    </details>
                  )}

                  {/* Open button */}
                  {req.organizer_id && (
                    <Link to={`/organizers/${req.organizer_id}`} target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-fit">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Profile
                    </Link>
                  )}

                  {/* Review panel — opens when admin clicks "Review Payout" */}
                  {reviewingId === req.id && (
                    <div className="p-4 rounded-xl bg-secondary/40 border border-primary/30 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Shield className="w-4 h-4" />
                        Payout Review — verify bank details below
                      </div>

                      {/* Bank details fetched from OrganizerBankInfo */}
                      {reviewBankData ? (
                        <div className="p-3 rounded-lg bg-card border border-border/30 text-sm grid grid-cols-2 gap-2">
                          <div><span className="text-xs text-muted-foreground block">Account Holder</span><span className="font-bold">{reviewBankData.account_holder_name || "—"}</span></div>
                          <div><span className="text-xs text-muted-foreground block">Bank</span><span className="font-bold">{reviewBankData.bank_name || "—"}</span></div>
                          <div><span className="text-xs text-muted-foreground block">Account Number</span><span className="font-mono font-bold">••••{reviewBankData.account_number?.slice(-4) || "—"}</span></div>
                          <div><span className="text-xs text-muted-foreground block">Account Type</span><span className="font-bold capitalize">{reviewBankData.account_type || "—"}</span></div>
                          {reviewBankData.routing_number && <div><span className="text-xs text-muted-foreground block">Routing Number</span><span className="font-mono font-bold">••••{reviewBankData.routing_number.slice(-4)}</span></div>}
                          {reviewBankData.iban && <div><span className="text-xs text-muted-foreground block">IBAN</span><span className="font-mono font-bold">{reviewBankData.iban}</span></div>}
                          {reviewBankData.swift_code && <div><span className="text-xs text-muted-foreground block">SWIFT</span><span className="font-mono font-bold">{reviewBankData.swift_code}</span></div>}
                          {reviewBankData.country && <div><span className="text-xs text-muted-foreground block">Country</span><span className="font-bold">{reviewBankData.country}</span></div>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                          Loading bank details...
                        </div>
                      )}

                      {/* Pre-approval confirmation */}
                      {confirmingId === req.id ? (
                        <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30 space-y-2">
                          <p className="text-sm font-bold text-yellow-400 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" /> Confirm Approval
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Payout of <strong className="text-foreground">${req.amount?.toFixed(2)}</strong> will be sent to:
                          </p>
                          {reviewBankData && (
                            <div className="text-xs font-mono space-y-0.5 text-foreground bg-card/50 p-2 rounded">
                              <div>🏦 <strong>{reviewBankData.bank_name}</strong></div>
                              <div>👤 {reviewBankData.account_holder_name}</div>
                              <div>🔢 Account: <strong>{reviewBankData.account_number}</strong></div>
                              {reviewBankData.routing_number && <div>🔢 Routing: <strong>{reviewBankData.routing_number}</strong></div>}
                              {reviewBankData.iban && <div>🔢 IBAN: <strong>{reviewBankData.iban}</strong></div>}
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => updateOrgStatus(req, "approved")} disabled={processing === req.id}
                              className="gap-2 glow-lime font-bold">
                              <CheckCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Yes, Approve Payout"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmingId(null)}>Go Back</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" onClick={() => setConfirmingId(req.id)}
                            className="gap-2 glow-lime font-bold">
                            <Banknote className="w-3.5 h-3.5" /> Approve Payout
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectingId(req.id)}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReviewingId(null); setReviewBankData(null); }}>
                            Close
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reject input */}
                  {rejectingId === req.id && (
                    <div className="space-y-2">
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateOrgStatus(req, "rejected")} disabled={processing === req.id}
                          className="bg-destructive hover:bg-destructive/90 gap-2">
                          <XCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Confirm Reject"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Default action bar — show Review button for pending payouts */}
                  {reviewingId !== req.id && rejectingId !== req.id && (
                    <div className="flex gap-2 flex-wrap">
                      {["requested", "pending_review"].includes(req.status) && (
                        <Button size="sm" onClick={async () => {
                          setReviewingId(req.id);
                          setReviewBankData(null);
                          try {
                            const bankInfos = await base44.entities.OrganizerBankInfo.filter({ organizer_id: req.organizer_id }, null, 1);
                            setReviewBankData(bankInfos[0] || null);
                          } catch { setReviewBankData(null); }
                        }} className="gap-2 font-bold">
                          <Eye className="w-3.5 h-3.5" /> Review Payout
                        </Button>
                      )}
                      {req.status === "approved" && (
                        <Button size="sm" onClick={() => updateOrgStatus(req, "completed")} disabled={processing === req.id} className="gap-2 bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Mark Completed"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Artist requests ── */}
      {!showResalePayout && roleTab === "artist" && (
        filteredArtist.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 font-mono text-sm">No artist payout requests found</p>
        ) : (
          <div className="space-y-4">
            {filteredArtist.map(req => {
              const cfg = ARTIST_STATUS_CONFIG[req.status] || ARTIST_STATUS_CONFIG.pending;
              const Icon = cfg.icon;

              return (
                <div key={req.id} className={`p-5 rounded-xl bg-card border ${req.status === "pending" ? "border-yellow-400/20" : "border-border/50"} space-y-4`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <p className="font-display font-bold">{req.artist_name || req.artist_email}</p>
                        <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">Artist</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{req.artist_email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested: {req.created_date ? format(new Date(req.created_date), "MMM d, yyyy 'at' h:mm a") : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Method: {req.payout_method === "paypal" ? `PayPal · ${req.paypal_email}` : `Bank · ${req.bank_name || "—"}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-primary text-xl">${req.amount?.toFixed(2)}</p>
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 mt-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                  </div>

                  {req.payout_method === "bank_transfer" && req.bank_name && (
                    <div className="p-3 rounded-lg bg-secondary/60 border border-border/30 text-sm grid grid-cols-2 gap-2">
                      <div><span className="text-xs text-muted-foreground block">Bank</span>{req.bank_name}</div>
                      <div><span className="text-xs text-muted-foreground block">Country</span>{req.bank_country || "—"}</div>
                      {req.bank_account_name && <div><span className="text-xs text-muted-foreground block">Holder</span>{req.bank_account_name}</div>}
                    </div>
                  )}

                  {req.processed_at && <p className="text-xs text-green-400 font-mono">✅ Processed: {format(new Date(req.processed_at), "MMM d, yyyy")}</p>}
                  {req.admin_note && <p className="text-xs text-muted-foreground font-mono">Note: {req.admin_note}</p>}
                  {req.notes && <p className="text-xs text-muted-foreground font-mono">Artist note: {req.notes}</p>}

                  {/* Open button */}
                  {req.artist_id && (
                    <Link to={`/artists/${req.artist_id}`} target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-fit">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Profile
                    </Link>
                  )}

                  {rejectingId === req.id ? (
                    <div className="space-y-2">
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateArtistStatus(req, "rejected")} disabled={processing === req.id}
                          className="bg-destructive hover:bg-destructive/90 gap-2">
                          <XCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Confirm Reject"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {req.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => updateArtistStatus(req, "processing")} disabled={processing === req.id} className="gap-2 glow-lime font-bold">
                            <CheckCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectingId(req.id)} className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {req.status === "processing" && (
                        <Button size="sm" onClick={() => updateArtistStatus(req, "completed")} disabled={processing === req.id} className="gap-2 bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> {processing === req.id ? "Processing..." : "Mark Completed"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}