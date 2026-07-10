import { useState, useEffect, useCallback } from "react";
import {
  Gift, Plus, Trash2, Loader2, Save, Trophy, Shuffle,
  RotateCcw, CheckCircle2, AlertTriangle, Users, BadgeCheck, Mail, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";
import WinnerResultModal from "./WinnerResultModal";

// ── LocalStorage helpers ───────────────────────────────────────────────────────
const SAVED_KEY = "giveaway_subjects_v1";
function getSavedSubjects() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}
function persistSubject(subject) {
  const list = getSavedSubjects();
  if (!list.includes(subject)) {
    localStorage.setItem(SAVED_KEY, JSON.stringify([subject, ...list].slice(0, 30)));
  }
}

const EMPTY_ITEM = () => ({ subject: "", quantity: "", touched_subject: false, touched_qty: false });

// ── Fisher-Yates shuffle ───────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Single item row ────────────────────────────────────────────────────────────
function GiveawayRow({ item, idx, totalRows, onChange, onRemove }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const openSuggestions = () => {
    setSuggestions(getSavedSubjects());
    setShowSuggestions(true);
  };

  const filtered = suggestions
    .filter(s => !item.subject || s.toLowerCase().includes(item.subject.toLowerCase()))
    .slice(0, 8);

  const hasSubjectError = item.touched_subject && !item.subject.trim();
  const hasQtyError = item.touched_qty && (item.quantity === "" || Number(item.quantity) < 1);

  return (
    <div className="relative">
      <div className="flex gap-2 items-start">
        <div className="flex-1 relative">
          <Input
            placeholder="e.g. Free VIP Tickets, Comp Drink, Merch T-Shirt…"
            value={item.subject}
            onChange={e => onChange(idx, "subject", e.target.value)}
            onFocus={openSuggestions}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150);
              onChange(idx, "touched_subject", true);
            }}
            className={`bg-background border-border/50 ${hasSubjectError ? "border-destructive" : ""}`}
          />
          {hasSubjectError && <p className="text-[10px] text-destructive mt-0.5 font-mono">Item name required</p>}
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl max-h-44 overflow-y-auto">
              {filtered.map(s => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onMouseDown={() => { onChange(idx, "subject", s); setShowSuggestions(false); }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-24 shrink-0">
          <Input
            type="number"
            min={1}
            placeholder="Qty"
            value={item.quantity}
            onChange={e => onChange(idx, "quantity", e.target.value)}
            onBlur={() => onChange(idx, "touched_qty", true)}
            className={`bg-background border-border/50 ${hasQtyError ? "border-destructive" : ""}`}
          />
          {hasQtyError && <p className="text-[10px] text-destructive mt-0.5 font-mono">Min 1</p>}
        </div>
        <button
          onClick={() => onRemove(idx)}
          disabled={totalRows === 1}
          className="mt-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-25"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Winners display (organizer view with redeem verification) ─────────────────
function WinnersDisplay({ giveaway, event, onReset, onMarkRedeemed, onResendEmail }) {
  const grouped = {};
  (giveaway.winners || []).forEach(w => {
    if (!grouped[w.item_subject]) grouped[w.item_subject] = [];
    grouped[w.item_subject].push(w);
  });

  const totalRedeemed = (giveaway.winners || []).filter(w => w.redeem_status === "redeemed").length;
  const total = (giveaway.winners || []).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="font-display font-bold text-sm text-green-400">WINNERS DRAWN</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {giveaway.drawn_at ? format(new Date(giveaway.drawn_at), "MMM d, yyyy h:mm a") : ""}
          </span>
          {giveaway.drawn_by && (
            <span className="font-mono text-[10px] text-muted-foreground">by {giveaway.drawn_by}</span>
          )}
        </div>
        <Button size="sm" variant="ghost" className="text-muted-foreground gap-1.5 text-xs" onClick={onReset}>
          <RotateCcw className="w-3 h-3" /> Reset & Re-draw
        </Button>
      </div>

      {Object.entries(grouped).map(([subject, winners]) => (
        <div key={subject} className="p-3 rounded-lg bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-3.5 h-3.5 text-primary/60" />
            <span className="font-bold text-sm">{subject}</span>
            <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {winners.length} winner{winners.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {winners.map((w, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/20 last:border-0 flex-wrap">
                <div className="flex items-center gap-2">
                  <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />
                  <div>
                    <span className="font-medium text-sm">{w.winner_name || w.winner_email}</span>
                    <span className="text-muted-foreground text-xs font-mono ml-2">{w.winner_email}</span>
                    {w.redeem_code && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Code: {w.redeem_code}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {w.redeem_status === "redeemed" ? (
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-green-400/10 text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Redeemed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] font-mono gap-1 border-green-400/30 text-green-400 hover:bg-green-400/10"
                      onClick={() => onMarkRedeemed(w)}
                    >
                      <BadgeCheck className="w-3 h-3" /> Mark Redeemed
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] font-mono gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => onResendEmail(w)}
                  >
                    <Mail className="w-3 h-3" /> Resend Email
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
        <span className="text-xs text-muted-foreground font-mono">REDEMPTIONS</span>
        <span className="font-mono font-bold text-primary">{totalRedeemed} / {total}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GiveawayManager({ event }) {
  const [giveaway, setGiveaway] = useState(null);
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [winnerModal, setWinnerModal] = useState(null); // { winners, drawnAt }
  const [resendingEmail, setResendingEmail] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const [data, user] = await Promise.all([
      base44.entities.EventGiveaway.filter({ event_id: event.id }, "-created_date", 1).catch(() => []),
      base44.auth.me().catch(() => null),
    ]);
    setCurrentUser(user);
    const record = data[0] || null;
    setGiveaway(record);
    if (record?.items?.length) {
      setItems(record.items.map(i => ({
        subject: i.subject || "",
        quantity: String(i.quantity || ""),
        touched_subject: false,
        touched_qty: false,
      })));
    } else {
      setItems([EMPTY_ITEM()]);
    }
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const totalWinners = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const isDrawn = giveaway?.status === "drawn";

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const addRow = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeRow = (idx) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save giveaway items ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setItems(prev => prev.map(i => ({ ...i, touched_subject: true, touched_qty: true })));
    const validItems = items.filter(i => i.subject.trim() && Number(i.quantity) >= 1);
    const hasInvalid = items.some(i => !i.subject.trim() || Number(i.quantity) < 1 || i.quantity === "");

    if (validItems.length === 0) { toast.error("Add at least one giveaway item"); return; }
    if (hasInvalid) { toast.error("Fix invalid rows (remove empty rows or set quantity ≥ 1)"); return; }

    setSaving(true);
    validItems.forEach(i => persistSubject(i.subject.trim()));

    const payload = {
      event_id: event.id,
      event_title: event.title,
      organizer_id: currentUser?.id || event.organizer_id,
      items: validItems.map(i => ({ subject: i.subject.trim(), quantity: Number(i.quantity) })),
      status: "active",
      // clear any previous draw when items are re-saved
      winners: [],
      drawn_at: null,
      drawn_by: null,
    };

    if (giveaway) {
      await base44.entities.EventGiveaway.update(giveaway.id, payload);
      toast.success("Giveaway updated!");
    } else {
      const created = await base44.entities.EventGiveaway.create(payload);
      setGiveaway(created);
      toast.success("Giveaway created!");
    }
    setSaving(false);
    load();
  };

  // ── Draw winners ─────────────────────────────────────────────────────────────
  const handleDraw = async () => {
    if (!giveaway) return;
    if (isDrawn) { toast.error("Winners already drawn. Use Reset & Re-draw to draw again."); return; }

    setDrawing(true);

    // Fetch all active ticket holders for this event (eligible participants)
    const tickets = await base44.entities.Ticket.filter(
      { event_id: event.id, status: "active" },
      null, 500
    ).catch(() => []);

    // Also include scanned tickets (already checked in, still valid participants)
    const scannedTickets = await base44.entities.Ticket.filter(
      { event_id: event.id, status: "scanned" },
      null, 500
    ).catch(() => []);

    const allTickets = [...tickets, ...scannedTickets];

    // Deduplicate by email — one entry per unique participant
    const seenEmails = new Set();
    const participants = [];
    allTickets.forEach(t => {
      if (t.owner_email && !seenEmails.has(t.owner_email)) {
        seenEmails.add(t.owner_email);
        participants.push({ email: t.owner_email, name: t.owner_name || t.owner_email });
      }
    });

    if (participants.length === 0) {
      toast.error("No ticket holders found for this event. Sell tickets first to have eligible participants.");
      setDrawing(false);
      return;
    }

    const totalRequired = giveaway.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    if (participants.length < totalRequired) {
      toast(`⚠️ Only ${participants.length} participants available but ${totalRequired} winners needed. Drawing all available.`);
    }

    // Shuffle participants once — then pick from the pool sequentially
    // This ensures no one wins twice across different items in the same draw
    const shuffled = shuffleArray(participants);
    let poolIndex = 0;
    const winners = [];

    for (const item of giveaway.items) {
      const qty = Number(item.quantity) || 0;
      for (let i = 0; i < qty; i++) {
        if (poolIndex >= shuffled.length) break; // not enough unique participants
        winners.push({
          item_subject: item.subject,
          winner_email: shuffled[poolIndex].email,
          winner_name: shuffled[poolIndex].name,
        });
        poolIndex++;
      }
    }

    const drawnAt = new Date().toISOString();
    // Add default redeem_status to each winner
    const winnersWithStatus = winners.map(w => ({ ...w, redeem_status: "won" }));

    await base44.entities.EventGiveaway.update(giveaway.id, {
      status: "drawn",
      drawn_at: drawnAt,
      drawn_by: currentUser?.email || "",
      winners: winnersWithStatus,
    });

    // ── In-app notifications + emails ──────────────────────────────────────────
    // Group winners by email so one user winning multiple items gets one notification
    const byEmail = {};
    winnersWithStatus.forEach(w => {
      if (!byEmail[w.winner_email]) byEmail[w.winner_email] = [];
      byEmail[w.winner_email].push(w.item_subject);
    });

    await Promise.allSettled(Object.entries(byEmail).map(async ([email, prizeList]) => {
      const name = winnersWithStatus.find(w => w.winner_email === email)?.winner_name || email;
      const prizeSummary = prizeList.join(", ");

      // In-app notification — link goes directly to My Tickets where MyGiveawayWins appears
      await base44.entities.Notification.create({
        user_email: email,
        title: `🎉 You won in ${event.title}!`,
        message: `Congratulations! You won: ${prizeSummary}. Click here to claim your prize.`,
        type: "general",
        event_id: event.id,
        event_title: event.title,
        link: "/my-tickets?tab=wins",
      }).catch(() => {});

      // Winner email
      await sendEmail({
        _source: "GiveawayManager/draw",
        to: email,
        subject: `🎉 You won in ${event.title}!`,
        body: buildEmailBody({
          title: "🎉 Congratulations, You're a Winner!",
          greeting: `Hi ${name},`,
          message: `You've been selected as a winner in the giveaway for <strong>${event.title}</strong>!`,
          infoBox: {
            highlight: true,
            rows: [
              { label: "Event", value: event.title },
              { label: "Prize(s) Won", value: prizeSummary },
              { label: "Draw Date", value: format(new Date(drawnAt), "MMM d, yyyy h:mm a") },
            ],
          },
          extraLines: [
            "To claim your prize, click the button below and go to <strong>My Giveaway Wins</strong>.",
            "Show your redeem code to the event organizer at the venue to collect your prize.",
          ],
          ctaText: "Claim My Prize →",
          ctaUrl: `${window.location.origin}/my-tickets`,
          footerNote: "Contact the event organizer if you have any questions about prize collection.",
        }),
      }).catch(() => {});
    }));

    setDrawing(false);
    load();
    // Show winner spotlight modal immediately after draw
    setWinnerModal({ winners: winnersWithStatus, drawnAt });
  };

  // ── Organizer marks a winner as redeemed ────────────────────────────────────
  const handleMarkRedeemed = async (winnerRecord) => {
    if (!giveaway) return;
    if (winnerRecord.redeem_status === "redeemed") {
      toast.error("Already marked as redeemed.");
      return;
    }
    const redeemedAt = new Date().toISOString();
    const updatedWinners = (giveaway.winners || []).map(w => {
      if (w.winner_email === winnerRecord.winner_email && w.item_subject === winnerRecord.item_subject) {
        return { ...w, redeem_status: "redeemed", redeemed_at: redeemedAt, redeemed_by: currentUser?.email || "organizer" };
      }
      return w;
    });
    await base44.entities.EventGiveaway.update(giveaway.id, { winners: updatedWinners });
    toast.success(`Marked as redeemed for ${winnerRecord.winner_name || winnerRecord.winner_email}`);
    load();
  };

  // ── Resend winner email ──────────────────────────────────────────────────────
  const handleResendEmail = async (winnerRecord) => {
    const key = winnerRecord.winner_email + winnerRecord.item_subject;
    setResendingEmail(r => ({ ...r, [key]: true }));
    const drawnAt = giveaway?.drawn_at || new Date().toISOString();
    await sendEmail({
      _source: "GiveawayManager/resend",
      to: winnerRecord.winner_email,
      subject: `🎉 Congratulations! You won the raffle for ${event.title}`,
      body: buildEmailBody({
        title: "🏆 You're a Raffle Winner!",
        greeting: `Hi ${winnerRecord.winner_name || "Winner"},`,
        message: `Congratulations! You have been selected as a raffle winner for <strong>${event.title}</strong>.`,
        infoBox: {
          highlight: true,
          rows: [
            { label: "Event", value: event.title },
            { label: "Prize Won", value: winnerRecord.item_subject },
            { label: "Drawn At", value: format(new Date(drawnAt), "MMM d, yyyy h:mm a") },
          ],
        },
        extraLines: [
          "To claim your prize, visit the event or contact the organizer directly.",
          "Please bring a valid ID and mention your winning email when claiming your prize.",
        ],
        ctaText: "View My Wins →",
        ctaUrl: `${window.location.origin}/my-tickets`,
        footerNote: "Contact the event organizer if you have questions about prize collection.",
      }),
    }).catch(() => {});
    toast.success(`Email resent to ${winnerRecord.winner_email}`);
    setResendingEmail(r => ({ ...r, [key]: false }));
  };

  // ── Reset draw ───────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!giveaway) return;
    const confirmed = window.confirm("A winner has already been selected. Are you sure you want to reset and redraw?");
    if (!confirmed) return;
    await base44.entities.EventGiveaway.update(giveaway.id, {
      status: "active",
      drawn_at: null,
      drawn_by: null,
      winners: [],
    });
    toast.success("Draw reset. You can draw again.");
    load();
  };

  // ── Delete entire giveaway ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!giveaway) return;
    await base44.entities.EventGiveaway.delete(giveaway.id);
    setGiveaway(null);
    setItems([EMPTY_ITEM()]);
    toast.success("Giveaway removed");
  };

  if (loading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Winner result modal */}
      {winnerModal && (
        <WinnerResultModal
          winners={winnerModal.winners}
          event={event}
          drawnAt={winnerModal.drawnAt}
          onClose={() => setWinnerModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-lg">GIVEAWAY</h3>
          {totalWinners > 0 && !isDrawn && (
            <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
              {totalWinners} total winner{totalWinners !== 1 ? "s" : ""}
            </span>
          )}
          {isDrawn && (
            <span className="font-mono text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> DRAWN
            </span>
          )}
        </div>
        {giveaway && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Remove Giveaway
          </Button>
        )}
      </div>

      {/* Re-open winner spotlight for already-drawn giveaway */}
      {giveaway && isDrawn && giveaway.winners?.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs font-mono border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => setWinnerModal({ winners: giveaway.winners, drawnAt: giveaway.drawn_at })}
          >
            <Trophy className="w-3 h-3" /> View Winner Details
          </Button>
        </div>
      )}

      {/* ── DRAWN STATE: show winners ── */}
      {giveaway && isDrawn ? (
        <WinnersDisplay
          giveaway={giveaway}
          event={event}
          onReset={handleReset}
          onMarkRedeemed={handleMarkRedeemed}
          onResendEmail={handleResendEmail}
        />
      ) : (
        <>
          {/* Items form */}
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">Ticket Holders Only</p>
                <p className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
                  This giveaway is available only to users who have purchased a ticket for this event. Winners are randomly selected from all ticket holders when you draw.
                </p>
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Giveaway Items</p>

            {items.map((item, idx) => (
              <GiveawayRow
                key={idx}
                item={item}
                idx={idx}
                totalRows={items.length}
                onChange={updateItem}
                onRemove={removeRow}
              />
            ))}

            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-border/30">
              <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground shrink-0" onClick={addRow}>
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
              {totalWinners > 0 && (
                <span className="font-mono text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  {totalWinners} winner{totalWinners !== 1 ? "s" : ""}
                </span>
              )}
              <div className="flex-1 hidden sm:block" />
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 shrink-0">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {giveaway ? "Update" : "Save"} Giveaway
              </Button>
            </div>
          </div>

          {/* Saved giveaway summary + Draw button */}
          {giveaway && giveaway.items?.length > 0 && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <p className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">Saved Giveaway</p>

              <div className="space-y-1.5">
                {giveaway.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Gift className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                      {item.subject}
                    </span>
                    <span className="font-mono font-bold text-primary shrink-0">×{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-primary/20 pt-3 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total Winners</span>
                    <span className="font-mono font-bold text-primary text-sm">
                      {giveaway.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}
                    </span>
                  </div>

                  {/* ── DRAW WINNERS BUTTON ── */}
                  <Button
                    onClick={handleDraw}
                    disabled={drawing}
                    className="gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm px-5"
                  >
                    {drawing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Shuffle className="w-4 h-4" />}
                    {drawing ? "Drawing…" : "🎲 Draw Winners Now"}
                  </Button>
                </div>

                {/* Guidance note */}
                <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-mono text-amber-300 leading-relaxed">
                    Winner draw is available here on this event management page once participants (ticket holders) join.
                    {" "}Winners are randomly selected from all ticket holders of this event.
                  </p>
                </div>

                <p className="text-[10px] font-mono text-muted-foreground">
                  Each participant can win only once per draw.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}