import { useState, useEffect } from "react";
import { ArrowLeft, Trophy, Users, Shuffle, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";
import { getAppUrl } from "@/lib/appUrl";
import { computeStatus } from "@/utils/statusUtils";

export default function AdminRaffleDetail({ raffle, onBack, STATUS_BADGE }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [currentRaffle, setCurrentRaffle] = useState(raffle);

  useEffect(() => {
    base44.entities.RaffleEntry.filter({ raffle_id: raffle.id }, "-created_date", 500)
      .then(e => { setEntries(e); setLoading(false); })
      .catch(() => setLoading(false));
  }, [raffle.id]);

  const displayStatus = computeStatus(currentRaffle);

  const pickWinners = async () => {
    if (entries.length === 0) { toast.error("No entries to pick from"); return; }
    setPicking(true);

    // Expand entries by num_entries weight
    const pool = [];
    entries.forEach(e => {
      for (let i = 0; i < (e.num_entries || 1); i++) pool.push(e);
    });

    const numWinners = Math.min(currentRaffle.num_winners || 1, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const seen = new Set();
    const winners = [];
    for (const entry of shuffled) {
      if (!seen.has(entry.user_email)) {
        seen.add(entry.user_email);
        winners.push(entry);
        if (winners.length >= numWinners) break;
      }
    }

    const winnerEmails = winners.map(w => w.user_email);
    const winnerNames = winners.map(w => w.user_name || w.user_email);
    const now = new Date().toISOString();

    // Mark winner entries
    await Promise.all(winners.map(w => base44.entities.RaffleEntry.update(w.id, { is_winner: true })));

    // Update raffle
    const updated = await base44.entities.EventRaffle.update(currentRaffle.id, {
      status: "drawn",
      winner_emails: winnerEmails,
      winner_names: winnerNames,
      drawn_at: now,
    });

    setCurrentRaffle(updated);
    setEntries(prev => prev.map(e => ({ ...e, is_winner: winnerEmails.includes(e.user_email) })));
    toast.success(`🎉 ${winners.length} winner(s) selected!`);
    setPicking(false);
  };

  const resendWinnerEmail = async () => {
    const winners = currentRaffle.winner_emails || [];
    const names = currentRaffle.winner_names || [];
    if (winners.length === 0) { toast.error("No winners to resend to"); return; }
    try {
      await Promise.all(
        winners.map((email, i) =>
          sendEmail({
            _source: 'AdminRaffleDetail/resendWinnerEmail',
            to: email,
            subject: `🎉 You won the ${currentRaffle.name || "raffle"}!`,
            body: buildEmailBody({
              title: '🏆 You won the raffle!',
              greeting: `Hi ${names[i] || 'there'},`,
              message: `Congratulations! You were selected as a winner of the <strong>${currentRaffle.name || "raffle"}</strong>${currentRaffle.event_title ? ` at <strong>${currentRaffle.event_title}</strong>` : ""}.`,
              infoBox: { highlight: true, rows: [
                { label: 'Prize', value: currentRaffle.prize_description || "—" },
                ...(currentRaffle.event_title ? [{ label: 'Event', value: currentRaffle.event_title }] : []),
                ...(currentRaffle.organizer_name ? [{ label: 'Organizer', value: currentRaffle.organizer_name }] : []),
              ]},
              extraLines: ['Please contact the organizer to claim your prize.'],
              ctaText: 'View My Tickets →',
              ctaUrl: getAppUrl('/my-tickets'),
              footerNote: 'Congratulations again! 🎉',
            }),
          })
        )
      );
      toast.success("Prize email has been resent to the winner.");
    } catch {
      toast.error("Failed to resend prize email. Please try again.");
    }
  };

  const exportCSV = () => {
    const rows = [["Name", "Email", "Entries", "Winner", "Entered At"]];
    entries.forEach(e => rows.push([e.user_name || "", e.user_email, e.num_entries || 1, e.is_winner ? "Yes" : "No", e.created_date ? format(new Date(e.created_date), "yyyy-MM-dd HH:mm") : ""]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raffle-entries-${currentRaffle.name || currentRaffle.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-black text-2xl">{currentRaffle.name || "Raffle"}</h1>
          <p className="text-muted-foreground text-sm">{currentRaffle.event_title}</p>
        </div>
        <span className={`text-xs font-mono font-bold uppercase px-3 py-1 rounded-full ${STATUS_BADGE[displayStatus] || STATUS_BADGE.upcoming}`}>
          {displayStatus}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entries", value: entries.length },
          { label: "Winners", value: `${currentRaffle.winner_names?.length || 0} / ${currentRaffle.num_winners || 1}` },
          { label: "Entry Fee", value: currentRaffle.entry_fee_type === "paid" ? `$${currentRaffle.entry_fee_amount}` : "Free" },
          { label: "Selection", value: currentRaffle.winner_selection || "random" },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">{label}</p>
            <p className="font-display font-black text-xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Prize & Description */}
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-2">
        <p className="font-display font-bold text-sm">🏆 PRIZE</p>
        <p className="text-sm">{currentRaffle.prize_description || "—"}</p>
        {currentRaffle.description && <p className="text-sm text-muted-foreground">{currentRaffle.description}</p>}
        <p className="text-xs font-mono text-muted-foreground">
          {currentRaffle.start_datetime ? format(new Date(currentRaffle.start_datetime), "MMM d, yyyy") : "—"} → {currentRaffle.end_datetime ? format(new Date(currentRaffle.end_datetime), "MMM d, yyyy") : "—"}
        </p>
      </div>

      {/* Winners */}
      {currentRaffle.winner_names?.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-5">
          <p className="font-display font-bold text-sm text-primary mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" /> WINNERS</p>
          <div className="space-y-2">
            {currentRaffle.winner_names.map((name, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground text-xs">{currentRaffle.winner_emails?.[i]}</span>
              </div>
            ))}
          </div>
          {currentRaffle.drawn_at && (
            <p className="text-xs font-mono text-muted-foreground mt-3">Drawn: {format(new Date(currentRaffle.drawn_at), "MMM d, yyyy HH:mm")}</p>
          )}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={resendWinnerEmail} className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
              <Mail className="w-3.5 h-3.5" /> Resend Prize Email
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {(displayStatus === "active" || displayStatus === "ended") && displayStatus !== "drawn" && (
          <Button onClick={pickWinners} disabled={picking || entries.length === 0} className="gap-2 font-display font-bold">
            <Shuffle className="w-4 h-4" /> {picking ? "Picking..." : "Pick Winners"}
          </Button>
        )}
        <Button variant="outline" onClick={exportCSV} className="gap-2" disabled={entries.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Entries table */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Users className="w-4 h-4" /> ENTRIES ({entries.length})
        </h2>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No entries yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Name", "Email", "Entries", "Winner", "Entered"].map(h => (
                      <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} className={`border-b border-border/30 last:border-0 ${entry.is_winner ? "bg-primary/5" : "hover:bg-muted/10"}`}>
                      <td className="p-3 font-medium text-xs flex items-center gap-2">
                        {entry.is_winner && <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />}
                        {entry.user_name || "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{entry.user_email}</td>
                      <td className="p-3 font-mono text-xs">{entry.num_entries || 1}</td>
                      <td className="p-3">
                        {entry.is_winner ? (
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">Winner</span>
                        ) : (
                          <span className="text-[10px] font-mono text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">
                        {entry.created_date ? format(new Date(entry.created_date), "MMM dd, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}