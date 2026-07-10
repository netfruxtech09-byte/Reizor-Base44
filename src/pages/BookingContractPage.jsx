import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText, Sparkles, Edit3, Lock, Unlock, CheckCircle2, Send,
  AlertTriangle, Clock, DollarSign, ChevronDown, ChevronUp, Save,
  ThumbsUp, ThumbsDown, Lightbulb, RefreshCw, Bot, X, Check, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { safeDownloadUrl } from "@/lib/mobileShare";
import PaymentStructureEditor from "../components/booking/PaymentStructureEditor";
import BookingNotesSection from "../components/booking/BookingNotesSection";
import BookingHistoryLog from "../components/booking/BookingHistoryLog";
import BookingPaymentTracker from "../components/booking/BookingPaymentTracker";
import BookingCancelModal from "../components/booking/BookingCancelModal";
import BackButton from "../components/shared/BackButton";

const STATUS_LABELS = {
  draft: { label: "Draft", color: "text-muted-foreground bg-muted" },
  pending_organizer_review: { label: "Pending Organizer Review", color: "text-yellow-400 bg-yellow-400/10" },
  pending_artist_review: { label: "Pending Artist Review", color: "text-yellow-400 bg-yellow-400/10" },
  payment_negotiation: { label: "Payment Negotiation", color: "text-accent bg-accent/10" },
  agreed: { label: "Agreed — Pending Signatures", color: "text-green-400 bg-green-400/10" },
  locked: { label: "Fully Executed ✓", color: "text-primary bg-primary/10" },
};

export default function BookingContractPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [contract, setContract] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingContract, setEditingContract] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [contractContent, setContractContent] = useState("");
  const [paymentDraft, setPaymentDraft] = useState([]);
  const [paymentNote, setPaymentNote] = useState("");
  const [showPaymentSection, setShowPaymentSection] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingContract, setAnalyzingContract] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState([]);
  const [rejectedSuggestions, setRejectedSuggestions] = useState([]);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const bookings = await base44.entities.ArtistBooking.filter({ id: bookingId }, null, 1);
      const b = bookings[0];
      setBooking(b);
      if (b) {
        const contracts = await base44.entities.BookingContract.filter({ booking_id: bookingId }, null, 1);
        if (contracts[0]) {
          setContract(contracts[0]);
          setContractContent(contracts[0].contract_content || "");
          setPaymentDraft(contracts[0].payment_structure || []);
          setSpecialRequests(contracts[0].artist_special_requests || "");
        }
      }
      setLoading(false);
    });
  }, [bookingId]);

  const isArtist = user?.email === contract?.artist_email || user?.email === booking?.artist_email;
  const isOrganizer = user?.email === contract?.booker_email || user?.email === booking?.booker_email;
  const isAdmin = user?.role === "admin";
  const isLocked = contract?.locked && !contract?.admin_unlocked;
  const canEdit = !isLocked || contract?.admin_unlocked;

  // Helper: log a history entry
  const logHistory = async (action, detail = "") => {
    if (!booking || !user) return;
    await base44.entities.BookingHistory.create({
      booking_id: booking.id,
      action,
      detail,
      actor_email: user.email,
      actor_name: user.full_name || user.email,
    }).catch(() => {});
    setHistoryRefresh(n => n + 1);
  };

  // Create contract from booking
  const handleCreate = async () => {
    if (!booking) return;
    const artists = await base44.entities.Artist.filter({ id: booking.artist_id }, null, 1);
    const a = artists[0];
    const c = await base44.entities.BookingContract.create({
      artist_id: booking.artist_id,
      artist_name: booking.artist_name,
      artist_email: booking.artist_email,
      booking_id: booking.id,
      event_name: booking.event_name,
      venue: booking.venue,
      city: booking.city,
      show_date: booking.event_date,
      fee: booking.budget,
      booker_name: booking.booker_name,
      booker_email: booking.booker_email,
      booker_phone: booking.booker_phone,
      contract_status: "draft",
    });
    setContract(c);
    setContractContent("");
    logHistory("Contract created", `Contract created for ${booking.event_name}`);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const prompt = `Generate a professional artist booking contract for the following event:

Artist: ${contract.artist_name}
Organizer / Promoter: ${contract.booker_name} (${contract.booker_email})
Event Name: ${contract.event_name}
Venue: ${contract.venue || "TBD"}, ${contract.city || ""}
Show Date: ${contract.show_date ? format(parseISO(contract.show_date), "EEEE, MMMM dd, yyyy") : "TBD"}
Performance Fee: $${contract.fee || 0}
${contract.soundcheck_time ? `Soundcheck Time: ${contract.soundcheck_time}` : ""}
${contract.performance_time ? `Performance Time: ${contract.performance_time}` : ""}

Generate a legally formatted booking contract covering:
1. Parties and Introduction
2. Performance Details (date, venue, set times)
3. Artist Fee and Payment Terms (placeholder for payment schedule)
4. Technical Rider Requirements
5. Hospitality & Accommodation
6. Cancellation Policy (force majeure, artist cancellation, promoter cancellation)
7. Intellectual Property and Recording Rights
8. Liability and Indemnification
9. Governing Law
10. Signatures

Keep it professional, clear, and use [PLACEHOLDER] for specific values to be filled in. Format with numbered sections.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    setContractContent(result);
    setEditingContract(true);
    await base44.entities.BookingContract.update(contract.id, {
      contract_content: result,
      generated_by_ai: true,
    });
    setContract(c => ({ ...c, contract_content: result, generated_by_ai: true }));
    toast.success("Contract generated!");
    setGenerating(false);
  };

  const handleSaveContract = async () => {
    setSaving(true);
    const updated = await base44.entities.BookingContract.update(contract.id, {
      contract_content: contractContent,
      contract_status: isArtist ? "pending_organizer_review" : "pending_artist_review",
    });
    setContract(c => ({ ...c, ...updated }));
    setEditingContract(false);
    toast.success("Contract saved and sent for review");
    setSaving(false);
  };

  const handleSendPaymentProposal = async () => {
    if (paymentDraft.length === 0) { toast.error("Add at least one payment milestone"); return; }
    setSaving(true);
    const updated = await base44.entities.BookingContract.update(contract.id, {
      payment_proposal: paymentDraft,
      payment_proposal_by: user.email,
      payment_proposal_note: paymentNote,
      contract_status: "payment_negotiation",
      payment_agreed: false,
    });
    setContract(c => ({ ...c, ...updated }));
    setEditingPayment(false);
    toast.success("Payment proposal sent");
    setSaving(false);
  };

  const handleAcceptPayment = async () => {
    setSaving(true);
    const updated = await base44.entities.BookingContract.update(contract.id, {
      payment_structure: contract.payment_proposal,
      payment_proposal: [],
      payment_proposal_by: "",
      payment_agreed: true,
      contract_status: "agreed",
    });
    setContract(c => ({ ...c, ...updated }));
    setPaymentDraft(contract.payment_proposal || []);
    toast.success("Payment structure agreed!");
    setSaving(false);
  };

  const handleCounterPayment = () => {
    setPaymentDraft(contract.payment_proposal || []);
    setEditingPayment(true);
  };

  const handleSign = async () => {
    if (!signatureName.trim()) { toast.error("Please type your full name to sign"); return; }
    setSaving(true);
    const now = new Date().toISOString();
    let updates = {};
    if (isArtist) {
      updates = { artist_signed: true, artist_signed_at: now, artist_signature: signatureName };
    } else {
      updates = { organizer_signed: true, organizer_signed_at: now, organizer_signature: signatureName };
    }
    // Check if both will be signed
    const artistSigned = isArtist ? true : contract.artist_signed;
    const orgSigned = isOrganizer ? true : contract.organizer_signed;
    if (artistSigned && orgSigned) {
      updates.locked = true;
      updates.contract_status = "locked";
      updates.payment_structure = contract.payment_structure || [];
    }
    const updated = await base44.entities.BookingContract.update(contract.id, updates);
    setContract(c => ({ ...c, ...updated }));
    setSignatureName("");
    const sigLabel = isArtist ? "Artist" : "Organizer";
    logHistory("Contract signed", `${sigLabel} signed: ${signatureName}${artistSigned && orgSigned ? " — Contract fully executed" : ""}`);
    toast.success(artistSigned && orgSigned ? "🎉 Contract fully executed and locked!" : "Signed! Waiting for other party.");
    setSaving(false);
  };

  const handleRequestUnlock = async () => {
    if (!unlockReason.trim()) { toast.error("Please provide a reason"); return; }
    await base44.entities.BookingContract.update(contract.id, {
      unlock_requested: true,
      unlock_request_reason: unlockReason,
      unlock_request_by: user.email,
    });
    setContract(c => ({ ...c, unlock_requested: true, unlock_request_reason: unlockReason, unlock_request_by: user.email }));
    await base44.integrations.Core.SendEmail({
      to: "admin@reizor.com",
      subject: `🔓 Contract Unlock Request — ${contract.event_name}`,
      body: `A contract unlock has been requested.\n\nContract: ${contract.event_name}\nRequested by: ${user.full_name} (${user.email})\nReason: ${unlockReason}\n\nPlease review in the admin panel.`,
    }).catch(() => {});
    setShowUnlockForm(false);
    toast.success("Unlock request sent to admin");
  };

  const handleAnalyzeContract = async () => {
    if (!contract?.contract_content) { toast.error("No contract content to analyze"); return; }
    setAnalyzingContract(true);
    setShowAiPanel(true);
    setAppliedSuggestions([]);
    setRejectedSuggestions([]);
    const role = isArtist ? "ARTIST" : "ORGANIZER";
    const prompt = `You are a music industry contract specialist. Analyze the following booking contract from the perspective of the ${role}.

Contract:
${contract.contract_content}

Event: ${contract.event_name}
Fee: $${booking.budget || "TBD"}
Artist: ${contract.artist_name}
Organizer: ${contract.booker_name}

Provide a structured analysis. Return a JSON object with this exact structure:
{
  "overall_assessment": "brief 1-2 sentence overall verdict",
  "risk_level": "low" | "medium" | "high",
  "pros": ["pro 1", "pro 2", ...],
  "cons": ["con 1", "con 2", ...],
  "suggestions": [
    {
      "id": "s1",
      "priority": "high" | "medium" | "low",
      "section": "section name",
      "issue": "what the problem is",
      "current_text": "the problematic clause (short excerpt)",
      "suggested_change": "the exact replacement text or addition",
      "reason": "why this protects the ${role.toLowerCase()}"
    }
  ],
  "ready_to_sign": true | false,
  "sign_recommendation": "brief advice on whether to sign as-is or negotiate"
}`;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          overall_assessment: { type: "string" },
          risk_level: { type: "string" },
          pros: { type: "array", items: { type: "string" } },
          cons: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "object" } },
          ready_to_sign: { type: "boolean" },
          sign_recommendation: { type: "string" }
        }
      }
    });
    setAiAnalysis(result);
    setAnalyzingContract(false);
  };

  const handleApplySuggestion = async (suggestion) => {
    // Apply the suggested change to contract content
    let updated = contractContent || contract.contract_content;
    if (suggestion.current_text && suggestion.suggested_change) {
      updated = updated.replace(suggestion.current_text, suggestion.suggested_change);
    } else {
      updated = updated + `\n\n[AMENDMENT - ${suggestion.section}]\n${suggestion.suggested_change}`;
    }
    setContractContent(updated);
    setAppliedSuggestions(prev => [...prev, suggestion.id]);
    setEditingContract(true);
    await base44.entities.BookingContract.update(contract.id, { contract_content: updated });
    setContract(c => ({ ...c, contract_content: updated }));
    toast.success(`✓ Applied: ${suggestion.section}`);
  };

  const handleDownloadInvoice = async () => {
    setDownloadingInvoice(true);
    const response = await base44.functions.invoke('generateInvoice', { contractId: contract.id });
    const { pdf_base64, filename } = response.data;
    const invoiceName = filename || `Invoice_${contract.event_name?.replace(/\s+/g, '_') || 'booking'}.pdf`;
    await safeDownloadUrl(pdf_base64, invoiceName, { title: invoiceName });
    setDownloadingInvoice(false);
  };

  const handleAdminUnlock = async () => {
    await base44.entities.BookingContract.update(contract.id, {
      admin_unlocked: true,
      unlock_requested: false,
      locked: false,
      artist_signed: false,
      organizer_signed: false,
      contract_status: "agreed",
    });
    setContract(c => ({ ...c, admin_unlocked: true, unlock_requested: false, locked: false, artist_signed: false, organizer_signed: false, contract_status: "agreed" }));
    toast.success("Contract unlocked for editing");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">Booking not found</div>
  );

  const statusCfg = STATUS_LABELS[contract?.contract_status || "draft"];
  const hasPendingProposal = contract?.payment_proposal?.length > 0 && !contract?.payment_agreed;
  const proposalIsFromOtherParty = hasPendingProposal && contract.payment_proposal_by !== user?.email;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <BackButton className="mb-1" />
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-black text-3xl tracking-tight">BOOKING CONTRACT</h1>
            {contract && (
              <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{booking.event_name} · {booking.artist_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {contract && contract.payment_agreed && (
            <Button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              variant="outline"
              size="sm"
              className="gap-1.5 font-display font-bold text-xs"
            >
              {downloadingInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {downloadingInvoice ? 'Generating...' : 'Download Invoice'}
            </Button>
          )}
          {isLocked && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <Lock className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono text-primary font-bold">Fully Executed</span>
            </div>
          )}
          {booking && booking.status !== "cancelled" && (isOrganizer || isAdmin) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 font-display font-bold"
              onClick={() => setShowCancelModal(true)}
            >
              <X className="w-3.5 h-3.5" /> Cancel Booking
            </Button>
          )}
        </div>
      </div>

      {/* Cancellation Banner */}
      {booking.status === "cancelled" && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
          <p className="font-bold text-destructive mb-1">This booking has been cancelled.</p>
          {booking.cancellation_reason && (
            <p className="text-muted-foreground">Reason: {booking.cancellation_reason}</p>
          )}
          {booking.cancelled_by && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">Cancelled by: {booking.cancelled_by}</p>
          )}
        </div>
      )}

      {/* Booking Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Artist", value: booking.artist_name },
          { label: "Organizer", value: booking.booker_name },
          { label: "Event Date", value: booking.event_date ? format(parseISO(booking.event_date), "MMM dd, yyyy") : "TBD" },
          { label: "Fee", value: booking.budget ? `$${Number(booking.budget).toLocaleString()}` : "TBD" },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg bg-card border border-border/50">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className="font-bold text-sm mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* No contract yet */}
      {!contract && isArtist && (
        <div className="p-8 rounded-xl bg-card border border-border/50 text-center space-y-4">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="font-display font-bold text-lg">No Contract Yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a contract for this booking to get started</p>
          </div>
          <Button onClick={handleCreate} className="glow-lime font-display font-bold gap-2">
            <FileText className="w-4 h-4" /> Create Contract
          </Button>
        </div>
      )}

      {!contract && !isArtist && (
        <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
          <p className="text-muted-foreground">The artist hasn't created a contract yet.</p>
        </div>
      )}

      {contract && (
        <>
          {/* AI ANALYSIS PANEL */}
          {contract.contract_content && (
            <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-accent" />
                  <h2 className="font-display font-bold">AI Contract Analysis</h2>
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">Powered by AI</span>
                </div>
                <div className="flex gap-2">
                  {aiAnalysis && (
                    <button onClick={() => setShowAiPanel(v => !v)}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                      {showAiPanel ? "Hide" : "Show"}
                    </button>
                  )}
                  <Button
                    onClick={handleAnalyzeContract}
                    disabled={analyzingContract}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-mono text-xs border-accent/30 text-accent hover:bg-accent/10"
                  >
                    {analyzingContract ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> {aiAnalysis ? "Re-Analyze" : "Analyze Contract"}</>
                    )}
                  </Button>
                </div>
              </div>

              {analyzingContract && (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-mono">Reading contract and identifying risks...</p>
                </div>
              )}

              {aiAnalysis && showAiPanel && !analyzingContract && (
                <div className="p-4 space-y-5">
                  {/* Overall */}
                  <div className={`p-3 rounded-lg border ${
                    aiAnalysis.risk_level === "low" ? "bg-green-400/10 border-green-400/20" :
                    aiAnalysis.risk_level === "medium" ? "bg-yellow-400/10 border-yellow-400/20" :
                    "bg-destructive/10 border-destructive/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        aiAnalysis.risk_level === "low" ? "bg-green-400/20 text-green-400" :
                        aiAnalysis.risk_level === "medium" ? "bg-yellow-400/20 text-yellow-400" :
                        "bg-destructive/20 text-destructive"
                      }`}>{aiAnalysis.risk_level} risk</span>
                      <span className={`font-mono text-[10px] ${
                        aiAnalysis.ready_to_sign ? "text-green-400" : "text-yellow-400"
                      }`}>{aiAnalysis.ready_to_sign ? "✓ Ready to sign" : "⚠ Review suggested"}</span>
                    </div>
                    <p className="text-sm">{aiAnalysis.overall_assessment}</p>
                    <p className="text-xs text-muted-foreground italic mt-1">{aiAnalysis.sign_recommendation}</p>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-mono text-green-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" /> Favorable Terms
                      </p>
                      <ul className="space-y-1.5">
                        {aiAnalysis.pros?.map((pro, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-green-400 mt-0.5 shrink-0">✓</span> {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-mono text-destructive uppercase tracking-widest flex items-center gap-1.5">
                        <ThumbsDown className="w-3.5 h-3.5" /> Concerns
                      </p>
                      <ul className="space-y-1.5">
                        {aiAnalysis.cons?.map((con, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-destructive mt-0.5 shrink-0">✗</span> {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {aiAnalysis.suggestions?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> Suggested Changes ({aiAnalysis.suggestions.length})
                      </p>
                      {aiAnalysis.suggestions.map((s, i) => {
                        const applied = appliedSuggestions.includes(s.id);
                        const rejected = rejectedSuggestions.includes(s.id);
                        return (
                          <div key={i} className={`p-3 rounded-lg border transition-all ${
                            applied ? "bg-green-400/5 border-green-400/20 opacity-60" :
                            rejected ? "opacity-30 border-border/20 bg-muted/30" :
                            s.priority === "high" ? "bg-destructive/5 border-destructive/20" :
                            s.priority === "medium" ? "bg-yellow-400/5 border-yellow-400/20" :
                            "bg-card border-border/30"
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    s.priority === "high" ? "bg-destructive/20 text-destructive" :
                                    s.priority === "medium" ? "bg-yellow-400/20 text-yellow-400" :
                                    "bg-muted text-muted-foreground"
                                  }`}>{s.priority}</span>
                                  <span className="text-xs font-mono text-muted-foreground">{s.section}</span>
                                  {applied && <span className="text-[9px] font-mono text-green-400">✓ Applied</span>}
                                  {rejected && <span className="text-[9px] font-mono text-muted-foreground">Skipped</span>}
                                </div>
                                <p className="text-sm font-medium">{s.issue}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                                {s.suggested_change && (
                                  <div className="mt-2 p-2 rounded bg-muted text-xs font-mono text-muted-foreground">
                                    <span className="text-accent">Suggested:</span> {s.suggested_change.slice(0, 120)}{s.suggested_change.length > 120 ? "..." : ""}
                                  </div>
                                )}
                              </div>
                              {!applied && !rejected && canEdit && (
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleApplySuggestion(s)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-colors"
                                  >
                                    <Check className="w-3 h-3" /> Apply
                                  </button>
                                  <button
                                    onClick={() => setRejectedSuggestions(prev => [...prev, s.id])}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border/30 hover:bg-muted/80 transition-colors"
                                  >
                                    <X className="w-3 h-3" /> Skip
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {appliedSuggestions.length > 0 && (
                    <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400">
                      ✓ {appliedSuggestions.length} suggestion{appliedSuggestions.length > 1 ? "s" : ""} applied to contract.
                      {canEdit && " Save & send for review when ready."}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SPECIAL REQUESTS */}
          {(isArtist || contract.artist_special_requests) && (
            <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <div className="p-4 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">⭐</span>
                  <h2 className="font-display font-bold">Special Requests</h2>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">From Artist</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {isArtist && !isLocked ? (
                  <>
                    <p className="text-xs text-muted-foreground font-mono">Add any special requests outside of the technical rider — dietary needs, dressing room requirements, travel preferences, etc.</p>
                    <textarea
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                      rows={4}
                      placeholder="e.g. Vegan catering, private dressing room, airport pickup required, specific hotel brand..."
                      className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
                    />
                    <Button
                      size="sm"
                      disabled={savingSpecial}
                      onClick={async () => {
                        setSavingSpecial(true);
                        await base44.entities.BookingContract.update(contract.id, { artist_special_requests: specialRequests });
                        setContract(c => ({ ...c, artist_special_requests: specialRequests }));
                        setSavingSpecial(false);
                        toast.success("Special requests saved");
                      }}
                      className="gap-1.5 font-display font-bold"
                    >
                      <Save className="w-3.5 h-3.5" /> {savingSpecial ? "Saving..." : "Save Requests"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {contract.artist_special_requests || <span className="italic">No special requests added.</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CONTRACT CONTENT */}
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="font-display font-bold">Contract Document</h2>
                {contract.generated_by_ai && (
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">AI Generated</span>
                )}
              </div>
              <div className="flex gap-2">
                {isArtist && canEdit && !editingContract && (
                  <>
                    {!contract.contract_content && (
                      <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline"
                        className="gap-1.5 font-mono text-xs border-accent/30 text-accent hover:bg-accent/10">
                        <Sparkles className="w-3.5 h-3.5" />
                        {generating ? "Generating..." : "AI Generate"}
                      </Button>
                    )}
                    <Button onClick={() => setEditingContract(true)} size="sm" variant="outline"
                      className="gap-1.5 font-mono text-xs">
                      <Edit3 className="w-3.5 h-3.5" /> {contract.contract_content ? "Edit" : "Write Manually"}
                    </Button>
                  </>
                )}
                {isArtist && canEdit && editingContract && (
                  <Button onClick={handleSaveContract} disabled={saving} size="sm" className="glow-lime font-display font-bold gap-1.5 text-xs">
                    <Send className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save & Send for Review"}
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4">
              {editingContract ? (
                <textarea
                  value={contractContent}
                  onChange={e => setContractContent(e.target.value)}
                  rows={20}
                  className="w-full rounded-lg bg-secondary border border-border/50 px-4 py-3 text-sm font-mono resize-y leading-relaxed"
                  placeholder="Write or paste your contract here..."
                />
              ) : contract.contract_content ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-muted-foreground max-h-[500px] overflow-y-auto">
                  {contract.contract_content}
                </pre>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No contract content yet. {isArtist ? "Use AI to generate or write manually." : "Waiting for artist to upload contract."}
                </div>
              )}
            </div>
          </div>

          {/* PAYMENT STRUCTURE */}
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 border-b border-border/30 hover:bg-muted/30 transition-colors"
              onClick={() => setShowPaymentSection(v => !v)}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <h2 className="font-display font-bold">Payment Structure</h2>
                {contract.payment_agreed && (
                  <span className="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Agreed ✓</span>
                )}
                {hasPendingProposal && (
                  <span className="text-[10px] font-mono text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded animate-pulse">
                    Proposal Pending
                  </span>
                )}
              </div>
              {showPaymentSection ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showPaymentSection && (
              <div className="p-4 space-y-4">
                {/* Pending proposal from other party */}
                {proposalIsFromOtherParty && canEdit && (
                  <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <p className="font-bold text-sm text-yellow-400">
                        {contract.payment_proposal_by === booking.artist_email ? "Artist" : "Organizer"} proposed a payment structure
                      </p>
                    </div>
                    {contract.payment_proposal_note && (
                      <p className="text-xs text-muted-foreground italic">"{contract.payment_proposal_note}"</p>
                    )}
                    <PaymentStructureEditor
                      structure={contract.payment_proposal}
                      onChange={() => {}}
                      totalFee={booking.budget || 0}
                      readOnly
                    />
                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleAcceptPayment} size="sm" className="glow-lime font-display font-bold gap-1.5 flex-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept Proposal
                      </Button>
                      <Button onClick={handleCounterPayment} size="sm" variant="outline" className="flex-1 font-display font-bold">
                        Counter Propose
                      </Button>
                    </div>
                  </div>
                )}

                {/* Own pending proposal */}
                {hasPendingProposal && !proposalIsFromOtherParty && (
                  <div className="p-3 rounded-lg bg-muted border border-border/30 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-1.5" />
                    Your payment proposal is pending review by the other party.
                    {contract.payment_proposal_note && <span className="italic ml-1">"{contract.payment_proposal_note}"</span>}
                  </div>
                )}

                {/* Agreed payment structure */}
                {contract.payment_agreed && contract.payment_structure?.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Agreed Payment Schedule</p>
                    <PaymentStructureEditor
                      structure={contract.payment_structure}
                      onChange={() => {}}
                      totalFee={booking.budget || 0}
                      readOnly
                    />
                  </div>
                )}

                {/* Edit / propose payment */}
                {canEdit && !contract.locked && (
                  <>
                    {editingPayment ? (
                      <div className="space-y-3 pt-2 border-t border-border/30">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                          {contract.payment_agreed ? "Counter Payment Proposal" : "Propose Payment Structure"}
                        </p>
                        <PaymentStructureEditor
                          structure={paymentDraft}
                          onChange={setPaymentDraft}
                          totalFee={booking.budget || 0}
                          readOnly={false}
                        />
                        <div>
                          <Label className="text-xs font-mono text-muted-foreground">Note to other party (optional)</Label>
                          <Input value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                            placeholder="Explain your proposed structure..."
                            className="mt-1 bg-secondary border-border/50 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSendPaymentProposal} disabled={saving} size="sm"
                            className="glow-lime font-display font-bold gap-1.5 flex-1">
                            <Send className="w-3.5 h-3.5" /> {saving ? "Sending..." : "Send Proposal"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingPayment(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      !hasPendingProposal && (
                        <button
                          onClick={() => { setPaymentDraft(contract.payment_structure || []); setEditingPayment(true); }}
                          className="text-xs font-mono text-accent hover:text-accent/80 transition-colors flex items-center gap-1.5 pt-1 border-t border-border/20 w-full">
                          <Edit3 className="w-3.5 h-3.5" />
                          {contract.payment_agreed ? "Propose changes to payment" : "Propose payment structure"}
                        </button>
                      )
                    )}
                  </>
                )}

                {contract.locked && (
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground p-2 rounded bg-muted">
                    <Lock className="w-3.5 h-3.5" /> Payment structure is locked per signed contract
                  </div>
                )}
              </div>
            )}
          </div>

          {/* E-SIGNATURES */}
          {(contract.payment_agreed || contract.payment_structure?.length > 0) && contract.contract_content && (
            <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <div className="p-4 border-b border-border/30">
                <h2 className="font-display font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> E-Signatures
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Artist signature */}
                  <div className={`p-4 rounded-lg border ${contract.artist_signed ? "border-green-400/30 bg-green-400/5" : "border-border/50 bg-secondary"}`}>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Artist</p>
                    <p className="font-bold text-sm">{contract.artist_name}</p>
                    {contract.artist_signed ? (
                      <div className="mt-2">
                        <p className="font-display font-black text-lg text-green-400 italic">{contract.artist_signature}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          Signed {format(parseISO(contract.artist_signed_at), "MMM dd, yyyy h:mm a")}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2 italic">Not yet signed</p>
                    )}
                  </div>

                  {/* Organizer signature */}
                  <div className={`p-4 rounded-lg border ${contract.organizer_signed ? "border-green-400/30 bg-green-400/5" : "border-border/50 bg-secondary"}`}>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Organizer</p>
                    <p className="font-bold text-sm">{contract.booker_name}</p>
                    {contract.organizer_signed ? (
                      <div className="mt-2">
                        <p className="font-display font-black text-lg text-green-400 italic">{contract.organizer_signature}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          Signed {format(parseISO(contract.organizer_signed_at), "MMM dd, yyyy h:mm a")}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2 italic">Not yet signed</p>
                    )}
                  </div>
                </div>

                {/* Sign CTA */}
                {canEdit && !isLocked && (
                  <>
                    {((isArtist && !contract.artist_signed) || (isOrganizer && !contract.organizer_signed)) && (
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-3">
                        <p className="text-sm font-bold">Sign this contract</p>
                        <p className="text-xs text-muted-foreground">By typing your full name below and clicking Sign, you agree to the contract terms and payment structure.</p>
                        <div className="flex gap-2">
                          <Input
                            value={signatureName}
                            onChange={e => setSignatureName(e.target.value)}
                            placeholder="Type your full legal name..."
                            className="bg-secondary border-border/50"
                          />
                          <Button onClick={handleSign} disabled={saving || !signatureName.trim()} className="glow-lime font-display font-bold gap-1.5 shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Sign
                          </Button>
                        </div>
                      </div>
                    )}
                    {((isArtist && contract.artist_signed) || (isOrganizer && contract.organizer_signed)) && !isLocked && (
                      <p className="text-sm text-muted-foreground font-mono text-center py-2">
                        ✓ You've signed — waiting for the other party
                      </p>
                    )}
                  </>
                )}

                {/* Locked notice */}
                {isLocked && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-bold text-sm text-primary">Contract Fully Executed</p>
                        <p className="text-xs text-muted-foreground">Both parties have signed. This contract is now locked.</p>
                      </div>
                    </div>
                    {!contract.unlock_requested && (
                      <button onClick={() => setShowUnlockForm(v => !v)}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
                        <Unlock className="w-3.5 h-3.5" /> Request Changes
                      </button>
                    )}
                    {contract.unlock_requested && (
                      <span className="text-xs font-mono text-yellow-400 shrink-0">⏳ Unlock request pending admin review</span>
                    )}
                  </div>
                )}

                {showUnlockForm && (
                  <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20 space-y-3">
                    <p className="text-sm font-bold text-yellow-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Request Contract Changes
                    </p>
                    <p className="text-xs text-muted-foreground">Both parties must agree to request changes. This will be reviewed by admin before any edits are permitted.</p>
                    <Input value={unlockReason} onChange={e => setUnlockReason(e.target.value)}
                      placeholder="Reason for requesting changes..."
                      className="bg-secondary border-border/50" />
                    <div className="flex gap-2">
                      <Button onClick={handleRequestUnlock} size="sm" variant="outline"
                        className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 font-display font-bold flex-1">
                        Send Request to Admin
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowUnlockForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Admin unlock */}
                {isAdmin && contract.unlock_requested && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-sm text-destructive">Admin: Unlock Request</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Requested by {contract.unlock_request_by}: "{contract.unlock_request_reason}"</p>
                    </div>
                    <Button onClick={handleAdminUnlock} size="sm" variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 font-display font-bold shrink-0 gap-1.5">
                      <Unlock className="w-3.5 h-3.5" /> Approve Unlock
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment Tracker */}
      {booking && (
        <BookingPaymentTracker
          booking={booking}
          onUpdate={(updates) => setBooking(b => ({ ...b, ...updates }))}
          onHistoryLog={logHistory}
        />
      )}

      {/* Internal Notes */}
      {booking && user && (
        <BookingNotesSection
          bookingId={booking.id}
          currentUser={user}
          onHistoryLog={logHistory}
        />
      )}

      {/* Event History / Audit Log */}
      {booking && (
        <BookingHistoryLog bookingId={booking.id} refreshTrigger={historyRefresh} />
      )}

      {/* Cancel Modal */}
      {showCancelModal && booking && user && (
        <BookingCancelModal
          booking={booking}
          currentUser={user}
          onClose={() => setShowCancelModal(false)}
          onCancelled={(updates) => {
            setBooking(b => ({ ...b, ...updates }));
          }}
        />
      )}
    </div>
  );
}