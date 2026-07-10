import { useState, useEffect, useMemo } from "react";
import { DollarSign, CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Banknote, Info, Calendar, TrendingUp, Settings, History, ChevronDown, ChevronUp, Ticket, ShoppingBag, Download, BookOpen, Heart, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BankDetailsFields, { validateBankDetails } from "@/components/shared/BankDetailsFields";
import { base44 } from "@/api/base44Client";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

const PAYOUT_COOLDOWN_DAYS = 14;

function getArtistPayoutEligibility(payouts) {
  const pending = payouts.find(p => ["pending", "processing"].includes(p.status));
  if (pending) return { eligible: false, nextDate: null, reason: "pending" };

  const completed = payouts.filter(p => p.status === "completed" && p.processed_at);
  const allDates = [
    ...completed.map(p => new Date(p.processed_at)),
    ...payouts.filter(p => p.created_date).map(p => new Date(p.created_date)),
  ].filter(d => !isNaN(d));

  if (allDates.length === 0) return { eligible: true, nextDate: null, reason: "first" };

  const lastDate = new Date(Math.max(...allDates));
  const nextDate = addDays(lastDate, PAYOUT_COOLDOWN_DAYS);
  if (new Date() >= nextDate) return { eligible: true, nextDate: null, reason: "ok" };
  return { eligible: false, nextDate, reason: "cooldown" };
}

const STATUS_CONFIG = {
  pending:    { label: "Pending",    color: "text-yellow-400 bg-yellow-400/10",   icon: Clock },
  processing: { label: "Processing", color: "text-accent bg-accent/10",           icon: AlertCircle },
  completed:  { label: "Paid Out",   color: "text-green-400 bg-green-400/10",     icon: CheckCircle2 },
  rejected:   { label: "Rejected",   color: "text-destructive bg-destructive/10", icon: XCircle },
};

const SCHEDULE_OPTIONS = [
  { value: "manual",    label: "Manual (request anytime)" },
  { value: "weekly",    label: "Weekly (every Monday)" },
  { value: "biweekly",  label: "Bi-Weekly (every 2 weeks)" },
  { value: "monthly",   label: "Monthly (1st of each month)" },
];

const STREAM_META = {
  donation:        { label: "Donations",        icon: Heart,       color: "text-pink-400" },
  merch:           { label: "Merchandise",      icon: ShoppingBag, color: "text-yellow-400" },
  digital_product: { label: "Digital Products", icon: Download,    color: "text-blue-400" },
  booking:         { label: "Bookings",         icon: BookOpen,    color: "text-orange-400" },
  ticket:          { label: "Ticket Sales",     icon: Ticket,      color: "text-green-400" },
};

const TABS = ["overview", "history", "settings"];

export default function ArtistPayouts() {
  const [artist, setArtist] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  // Payout request form
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState("bank_transfer");
  const [form, setForm] = useState({
    amount: "", paypal_email: "", notes: "",
    account_holder_name: "", bank_name: "", account_number: "", routing_number: "",
    account_type: "checking", country: "USA", swift_code: "", iban: "", bank_address: "",
  });
  const [bankErrors, setBankErrors] = useState({});

  // Settings
  const [schedule, setSchedule] = useState("manual");
  const [savedMethod, setSavedMethod] = useState("bank_transfer");
  const [savedBank, setSavedBank] = useState({ name: "", account: "", routing: "", bank_name: "" });
  const [savedPaypal, setSavedPaypal] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const [artists] = await Promise.all([
        base44.entities.Artist.filter({ user_email: user.email }, null, 1),
      ]);
      const a = artists[0];
      if (!a) { setLoading(false); return; }
      setArtist(a);

      // Load saved preferences
      if (a.payout_schedule) setSchedule(a.payout_schedule);
      if (a.payout_method) { setMethod(a.payout_method); setSavedMethod(a.payout_method); }
      if (a.payout_bank_name) setSavedBank({ name: a.payout_account_holder || "", account: "", routing: "", bank_name: a.payout_bank_name });
      if (a.payout_paypal_email) setSavedPaypal(a.payout_paypal_email);

      // Fetch all revenue sources in parallel
      const [donations, merchs, digitals, bookings, payoutList] = await Promise.all([
        base44.entities.ArtistDonation.filter({ artist_id: a.id, status: "completed" }, "-created_date", 500),
        base44.entities.MerchOrder.filter({ artist_email: a.user_email, status: "completed" }, "-created_date", 500).catch(() => []),
        base44.entities.DigitalPurchase.filter({ artist_email: a.user_email }, "-created_date", 500).catch(() => []),
        base44.entities.ArtistBooking.filter({ artist_email: a.user_email, status: "accepted" }, "-created_date", 200).catch(() => []),
        base44.entities.ArtistPayout.filter({ artist_id: a.id }, "-created_date", 100),
      ]);

      // Normalize to common transaction shape
      const txns = [
        ...donations.map(d => ({ id: d.id, date: d.created_date, stream: "donation", gross: d.amount || 0, net: d.net_amount || 0, label: d.donor_name ? `Donation from ${d.donor_name}` : "Anonymous donation" })),
        ...merchs.map(m => ({ id: m.id, date: m.created_date, stream: "merch", gross: m.total || 0, net: m.artist_payout || m.total || 0, label: m.product_name || "Merch sale" })),
        ...digitals.map(d => ({ id: d.id, date: d.created_date, stream: "digital_product", gross: d.amount || 0, net: d.net_amount || d.amount || 0, label: d.product_title || "Digital product sale" })),
        ...bookings.map(b => ({ id: b.id, date: b.created_date, stream: "booking", gross: b.budget || 0, net: b.budget || 0, label: b.event_name || "Booking" })),
      ];
      txns.sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactions(txns);
      setPayouts(payoutList);
      setLoading(false);
    });
  }, []);

  // Balance calculations
  const totalEarned = useMemo(() => transactions.reduce((s, t) => s + t.net, 0), [transactions]);
  const totalPaidOut = useMemo(() => payouts.filter(p => p.status === "completed").reduce((s, p) => s + (p.amount || 0), 0), [payouts]);
  const pendingPayouts = useMemo(() => payouts.filter(p => ["pending","processing"].includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0), [payouts]);
  const availableBalance = Math.max(0, totalEarned - totalPaidOut - pendingPayouts);

  // Breakdown by stream
  const streamBreakdown = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!map[t.stream]) map[t.stream] = { gross: 0, net: 0, count: 0 };
      map[t.stream].gross += t.gross;
      map[t.stream].net += t.net;
      map[t.stream].count += 1;
    });
    return map;
  }, [transactions]);

  // Monthly statements
  const monthlyStatements = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const key = format(new Date(t.date), "yyyy-MM");
      if (!map[key]) map[key] = { gross: 0, net: 0, count: 0, label: format(new Date(t.date), "MMMM yyyy") };
      map[key].gross += t.gross;
      map[key].net += t.net;
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([key, val]) => ({ key, ...val }));
  }, [transactions]);

  const eligibility = getArtistPayoutEligibility(payouts);

  const handleRequest = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount < 10) { toast.error("Minimum payout is $10"); return; }
    if (amount > availableBalance) { toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`); return; }
    if (!eligibility.eligible) {
      if (eligibility.reason === "pending") toast.error("You already have a pending payout request.");
      else toast.error("Not yet eligible for payout.");
      return;
    }
    if (method === "bank_transfer") {
      const errs = validateBankDetails(form);
      if (Object.keys(errs).length > 0) { setBankErrors(errs); return; }
    }
    if (method === "paypal" && !form.paypal_email) { toast.error("Enter your PayPal email"); return; }

    setSubmitting(true);
    const now = new Date().toISOString();
    const payout = await base44.entities.ArtistPayout.create({
      artist_id: artist.id, artist_name: artist.display_name, artist_email: artist.user_email,
      amount, payout_method: method,
      bank_account_name: form.account_holder_name, bank_account_number: form.account_number,
      bank_routing_number: form.routing_number, bank_name: form.bank_name,
      bank_country: form.country, bank_swift: form.swift_code, bank_iban: form.iban,
      bank_address: form.bank_address,
      paypal_email: form.paypal_email, notes: form.notes, status: "pending",
    });

    // Notify admins with duplicate check
    const adminUsers = await base44.entities.User.list(null, 200).catch(() => []);
    const admins = adminUsers.filter(u => u.role === "admin");
    const notifTitle = `💸 Artist Payout Request: ${artist.display_name}`;

    await Promise.all(admins.map(async admin => {
      const existing = await base44.entities.Notification.filter({ user_email: admin.email, title: notifTitle }, null, 5).catch(() => []);
      const alreadySent = existing.some(n => n.message?.includes(payout.id));
      if (!alreadySent) {
        await base44.entities.Notification.create({
          user_email: admin.email,
          title: notifTitle,
          message: `New payout request submitted by ${artist.display_name} ($${amount.toFixed(2)}). Role: artist. Request ID: ${payout.id}. Requested: ${format(new Date(now), "MMM d, yyyy")}.`,
          type: "general",
          link: "/admin/payouts",
        }).catch(() => {});
      }
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `💸 Artist Payout Request — ${artist.display_name} — $${amount.toFixed(2)}`,
        body: `Artist ${artist.display_name} (${artist.user_email}) requested a payout.\n\nAmount: $${amount.toFixed(2)}\nMethod: ${method === "bank_transfer" ? "Bank Transfer" : "PayPal"}\nStatus: Pending Review\nRequest ID: ${payout.id}\n\nNotes: ${form.notes || "None"}`,
      }).catch(() => {});
    }));

    setPayouts(p => [payout, ...p]);
    setShowForm(false);
    setBankErrors({});
    setForm({
      amount: "", paypal_email: "", notes: "",
      account_holder_name: "", bank_name: "", account_number: "", routing_number: "",
      account_type: "checking", country: "USA", swift_code: "", iban: "", bank_address: "",
    });
    toast.success("Your payout request has been submitted for admin review.");
    setSubmitting(false);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await base44.auth.updateMe({
      payout_schedule: schedule,
      payout_method: savedMethod,
      payout_bank_name: savedBank.bank_name,
      payout_account_holder: savedBank.name,
      payout_paypal_email: savedPaypal,
    });
    toast.success("Payout settings saved!");
    setSavingSettings(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">PAYOUTS</h1>
        {/* Tab nav */}
        <div className="flex rounded-lg border border-border/50 overflow-hidden self-start sm:self-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 px-3 sm:px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all capitalize whitespace-nowrap ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Balance Summary — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Earned", value: `$${totalEarned.toFixed(2)}`, color: "text-foreground" },
          { label: "Available", value: `$${availableBalance.toFixed(2)}`, color: "text-green-400" },
          { label: "Pending", value: `$${pendingPayouts.toFixed(2)}`, color: "text-yellow-400" },
          { label: "Paid Out", value: `$${totalPaidOut.toFixed(2)}`, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 sm:p-4 rounded-xl bg-card border border-border/50 text-center">
            <p className="font-mono text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
            <p className={`font-display font-black text-lg sm:text-xl mt-1 truncate ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Revenue breakdown by stream */}
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> EARNINGS BY SOURCE</h2>
            {Object.keys(streamBreakdown).length === 0 ? (
              <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
                <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No earnings yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(streamBreakdown).map(([stream, data]) => {
                  const meta = STREAM_META[stream] || { label: stream, icon: DollarSign, color: "text-muted-foreground" };
                  const Icon = meta.icon;
                  return (
                    <div key={stream} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{meta.label}</p>
                        <p className="text-xs font-mono text-muted-foreground">{data.count} transaction{data.count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-display font-black text-lg ${meta.color}`}>${data.net.toFixed(2)}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">net</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payout schedule info */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm">
            <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-foreground font-bold">Payout Schedule: <span className="text-accent">{SCHEDULE_OPTIONS.find(s => s.value === schedule)?.label || "Manual"}</span></p>
              <p className="text-muted-foreground mt-0.5 text-xs">Minimum payout $10 · Platform fee already deducted · Processed within 3–5 business days. Change schedule in Settings.</p>
            </div>
          </div>

          {/* Request payout */}
          {!showForm ? (
            eligibility.reason === "pending" ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-400 font-bold">You already have a pending payout request.</p>
              </div>
            ) : !eligibility.eligible && eligibility.reason === "cooldown" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-400/10 border border-orange-400/20">
                  <CalendarClock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-400">Payout not available yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You can request your next payout on <strong className="text-foreground">{format(eligibility.nextDate, "MMM d, yyyy")}</strong>. Payout requests are available every {PAYOUT_COOLDOWN_DAYS} days from your last payout day.
                    </p>
                  </div>
                </div>
                <Button disabled className="gap-2 opacity-50 cursor-not-allowed font-display font-bold">
                  <Banknote className="w-4 h-4" /> Request Payout (available {format(eligibility.nextDate, "MMM d")})
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowForm(true)} disabled={availableBalance < 10} className="glow-lime font-display font-bold gap-2 w-full sm:w-auto">
                <Banknote className="w-4 h-4" />
                {availableBalance >= 10 ? `Request Payout ($${availableBalance.toFixed(2)} available)` : "Request Payout (min $10 required)"}
              </Button>
            )
          ) : (
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
              <h2 className="font-display font-bold text-lg">Request Payout</h2>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Payout Method</Label>
                <div className="flex rounded-lg border border-border/50 overflow-hidden mt-1">
                  {[{v:"bank_transfer",l:"Bank Transfer",icon:Banknote},{v:"paypal",l:"PayPal",icon:CreditCard}].map(({v,l,icon:Icon}) => (
                    <button key={v} onClick={() => setMethod(v)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-mono font-bold transition-all ${method===v?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground hover:bg-muted"}`}>
                      <Icon className="w-4 h-4" /> {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Amount (max ${availableBalance.toFixed(2)})</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                  <Input type="number" min="10" max={availableBalance} step="0.01" value={form.amount}
                    onChange={e => setForm({...form, amount: e.target.value})}
                    placeholder="0.00" className="pl-7 bg-secondary border-border/50" />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[25,50,100,250].filter(a => a <= availableBalance).map(a => (
                    <button key={a} onClick={() => setForm({...form, amount: String(a)})}
                      className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${form.amount===String(a)?"bg-primary text-primary-foreground border-primary":"bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>${a}</button>
                  ))}
                  <button onClick={() => setForm({...form, amount: availableBalance.toFixed(2)})}
                    className="px-3 py-1 rounded-lg border text-xs font-mono font-bold bg-secondary border-border/50 text-muted-foreground hover:border-primary/40">Max</button>
                </div>
              </div>
              {method === "bank_transfer" && (
                <BankDetailsFields
                  form={form}
                  onChange={(key, val) => { setForm(f => ({ ...f, [key]: val })); setBankErrors(e => ({ ...e, [key]: null })); }}
                  errors={bankErrors}
                  bgClass="bg-secondary"
                  showPassword
                />
              )}
              {method === "paypal" && (
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">PayPal Email *</Label>
                  <Input value={form.paypal_email} onChange={e => setForm({...form, paypal_email: e.target.value})} type="email" placeholder="you@example.com" className="mt-1 bg-secondary border-border/50" />
                </div>
              )}
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Notes (optional)</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any additional info..." className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleRequest} disabled={submitting} className="flex-1 glow-lime font-display font-bold">
                  {submitting ? "Submitting..." : "Submit Payout Request"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Monthly statements */}
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> MONTHLY STATEMENTS</h2>
            {monthlyStatements.length === 0 ? (
              <div className="text-center py-8 bg-card rounded-xl border border-border/50">
                <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No earnings data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthlyStatements.map(stmt => (
                  <div key={stmt.key} className="flex items-center gap-3 justify-between p-4 rounded-xl bg-card border border-border/50">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm truncate">{stmt.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">{stmt.count} txn{stmt.count !== 1 ? "s" : ""} · Gross: ${stmt.gross.toFixed(2)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-black text-lg text-green-400">${stmt.net.toFixed(2)}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">net</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <div className="space-y-6">
          {/* Transaction history */}
          <div>
            <h2 className="font-display font-bold text-base mb-3">TRANSACTION HISTORY ({transactions.length})</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border/50">
                <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {transactions.map(txn => {
                  const meta = STREAM_META[txn.stream] || { label: txn.stream, icon: DollarSign, color: "text-muted-foreground" };
                  const Icon = meta.icon;
                  return (
                    <div key={txn.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{txn.label}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{meta.label} · {format(new Date(txn.date), "MMM dd, yyyy")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-sm text-green-400">+${txn.net.toFixed(2)}</p>
                        {txn.gross !== txn.net && <p className="text-[10px] font-mono text-muted-foreground">gross ${txn.gross.toFixed(2)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payout history */}
          <div>
            <h2 className="font-display font-bold text-base mb-3">PAYOUT HISTORY ({payouts.length})</h2>
            {payouts.length === 0 ? (
              <div className="text-center py-8 bg-card rounded-xl border border-border/50">
                <Banknote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No payouts requested yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map(payout => {
                  const cfg = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <div key={payout.id} className="p-4 rounded-xl bg-card border border-border/50">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Banknote className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="font-display font-bold text-lg">${payout.amount?.toFixed(2)}</p>
                            <span className={`flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-1 rounded shrink-0 ${cfg.color}`}>
                              <Icon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground truncate">
                            {payout.payout_method === "paypal" ? `PayPal · ${payout.paypal_email}` : `Bank · ${payout.bank_name || "Transfer"}`}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {format(new Date(payout.created_date), "MMM d, yyyy")}
                            {payout.processed_at && ` · Processed ${format(new Date(payout.processed_at), "MMM d, yyyy")}`}
                          </p>
                        </div>
                      </div>
                      {payout.admin_note && (
                        <p className="mt-2 p-2 rounded bg-muted text-xs text-muted-foreground"><span className="font-bold text-foreground">Note: </span>{payout.admin_note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SETTINGS TAB ===== */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="font-display font-bold text-base">PAYOUT PREFERENCES</h2>
            </div>

            {/* Schedule */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Payout Schedule</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {SCHEDULE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSchedule(opt.value)}
                    className={`p-3 rounded-lg border text-left text-sm transition-all ${schedule===opt.value?"border-primary bg-primary/10 text-primary":"border-border/50 bg-secondary text-muted-foreground hover:border-primary/30"}`}>
                    <p className="font-bold">{opt.label}</p>
                  </button>
                ))}
              </div>
              {schedule !== "manual" && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  ℹ️ Automatic payouts will be triggered on schedule if your balance is ≥ $10. You can still request manually anytime.
                </p>
              )}
            </div>

            {/* Default method */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Default Payout Method</Label>
              <div className="flex rounded-lg border border-border/50 overflow-hidden mt-2">
                {[{v:"bank_transfer",l:"Bank Transfer",icon:Banknote},{v:"paypal",l:"PayPal",icon:CreditCard}].map(({v,l,icon:Icon}) => (
                  <button key={v} onClick={() => setSavedMethod(v)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-mono font-bold transition-all ${savedMethod===v?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground hover:bg-muted"}`}>
                    <Icon className="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved bank details */}
            {savedMethod === "bank_transfer" && (
              <div className="space-y-3">
                <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Saved Bank Details</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Account Holder</Label>
                    <Input value={savedBank.name} onChange={e => setSavedBank({...savedBank, name: e.target.value})} placeholder="Full name" className="mt-1 bg-secondary border-border/50" />
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Bank Name</Label>
                    <Input value={savedBank.bank_name} onChange={e => setSavedBank({...savedBank, bank_name: e.target.value})} placeholder="e.g. Chase" className="mt-1 bg-secondary border-border/50" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono">Account and routing numbers are not stored for security — enter them each time you request a payout.</p>
              </div>
            )}

            {/* Saved PayPal */}
            {savedMethod === "paypal" && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground">PayPal Email</Label>
                <Input value={savedPaypal} onChange={e => setSavedPaypal(e.target.value)} type="email" placeholder="you@example.com" className="mt-1 bg-secondary border-border/50" />
              </div>
            )}

            <Button onClick={saveSettings} disabled={savingSettings} className="glow-lime font-display font-bold">
              {savingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}