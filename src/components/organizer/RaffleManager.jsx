import { useState, useEffect } from "react";
import { Trophy, Shuffle, Plus, Trash2, Users, Gift, Mail } from "lucide-react";
import { getAppUrl } from "@/lib/appUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';
import { format } from "date-fns";

export default function RaffleManager({ event }) {
  const [raffles, setRaffles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", num_winners: 1, prize_description: "", description: "" });

  const load = async () => {
    const [data, fetchedTickets] = await Promise.all([
      base44.entities.EventRaffle.filter({ event_id: event.id }, "-created_date", 10),
      base44.entities.Ticket.filter({ event_id: event.id }, null, 300),
    ]);
    setRaffles(data);
    setTickets(fetchedTickets || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [event.id]);

  const createRaffle = async () => {
    if (!form.name || !form.prize_description || form.num_winners < 1) {
      toast.error("Fill in all fields");
      return;
    }
    const user = await base44.auth.me();
    await base44.entities.EventRaffle.create({
      name: form.name,
      event_id: event.id,
      event_title: event.title,
      organizer_id: event.organizer_id,
      organizer_name: event.organizer_name || user.full_name,
      num_winners: Number(form.num_winners),
      prize_description: form.prize_description,
      description: form.description,
      status: "upcoming",
      winner_emails: [],
      winner_names: [],
    });
    toast.success("Raffle created!");
    setShowForm(false);
    setForm({ name: "", num_winners: 1, prize_description: "", description: "" });
    load();
  };

  const drawWinners = async (raffle) => {
    // Guard: already drawn
    if (raffle.status === "drawn" || raffle.winner_emails?.length > 0) {
      toast.error("This raffle has already been drawn");
      return;
    }
    const eligible = tickets.filter((t) => t.status === "active" || t.status === "scanned");
    if (eligible.length === 0) {
      toast.error("No participants available for draw");
      return;
    }
    setDrawing(raffle.id);
    try {
      // Fetch loyalty accounts to weight entries by membership:
      // Standard = 1 entry, Premium = 3 entries, no membership = 1 entry
      const loyaltyAccounts = await base44.entities.LoyaltyAccount.list(null, 1000).catch(() => []);
      const loyaltyByEmail = {};
      for (const acc of loyaltyAccounts) {
        loyaltyByEmail[acc.user_email] = acc;
      }

      // Build weighted pool: Premium members get their ticket added 3×, Standard 1×
      const weightedPool = [];
      for (const t of eligible) {
        const acc = loyaltyByEmail[t.owner_email];
        const isActive = acc?.membership_status === "active";
        const isPremium = isActive && acc?.membership_plan === "premium";
        const weight = isPremium ? 3 : 1;
        for (let w = 0; w < weight; w++) {
          weightedPool.push(t);
        }
      }

      // Shuffle weighted pool, then pick unique winners by email
      const shuffled = [...weightedPool].sort(() => Math.random() - 0.5);
      const unique = [];
      const seen = new Set();
      for (const t of shuffled) {
        if (!seen.has(t.owner_email)) {
          seen.add(t.owner_email);
          unique.push(t);
        }
        if (unique.length >= raffle.num_winners) break;
      }

      if (unique.length === 0) {
        toast.error("Could not select any valid winners");
        setDrawing(false);
        return;
      }

      const winnerEmails = unique.map((t) => t.owner_email);
      const winnerNames = unique.map((t) => t.owner_name || t.owner_email);

      // Mark raffle as drawn
      await base44.entities.EventRaffle.update(raffle.id, {
        status: "drawn",
        winner_emails: winnerEmails,
        winner_names: winnerNames,
        drawn_at: new Date().toISOString(),
      });

      // Notify winners via in-app + email
      await Promise.all(
        unique.map((t) =>
          Promise.all([
            base44.entities.Notification.create({
              user_email: t.owner_email,
              title: "🎉 You won the raffle!",
              message: `Congrats! You won: ${raffle.prize_description} from the ${event.title} raffle.`,
              type: "general",
              event_id: event.id,
              event_title: event.title,
              link: `/raffle-win/${raffle.id}`,
            }),
            sendEmail({
              _source: 'RaffleManager/winnerNotification',
              to: t.owner_email,
              subject: `🎉 You won the ${event.title} raffle!`,
              body: buildEmailBody({
                title: '🏆 You won the raffle!',
                greeting: `Hi ${t.owner_name || 'there'},`,
                message: `Congratulations! You were randomly selected as a raffle winner at <strong>${event.title}</strong>!`,
                infoBox: { highlight: true, rows: [
                  { label: 'Prize', value: raffle.prize_description },
                  { label: 'Event', value: event.title },
                ]},
                extraLines: ['Contact the event organizer at the venue to collect your prize.'],
                ctaText: 'View My Tickets →',
                ctaUrl: getAppUrl('/my-tickets'),
                footerNote: 'See you on the dance floor! 🎶',
              }),
            }),
          ])
        )
      );

      toast.success(`🏆 ${winnerEmails.length} winner${winnerEmails.length > 1 ? "s" : ""} selected successfully!`);
      load();
    } catch (err) {
      console.error("[Draw] Failed:", err);
      toast.error("Draw failed — please try again");
    } finally {
      setDrawing(false);
    }
  };

  const resendWinnerEmail = async (raffle) => {
    const winners = raffle.winner_emails || [];
    const names = raffle.winner_names || [];
    if (winners.length === 0) { toast.error("No winners to resend to"); return; }
    try {
      await Promise.all(
        winners.map((email, i) =>
          sendEmail({
            _source: 'RaffleManager/resendWinnerEmail',
            to: email,
            subject: `🎉 You won the ${event.title} raffle!`,
            body: buildEmailBody({
              title: '🏆 You won the raffle!',
              greeting: `Hi ${names[i] || 'there'},`,
              message: `Congratulations! You were selected as a raffle winner at <strong>${event.title}</strong>!`,
              infoBox: { highlight: true, rows: [
                { label: 'Prize', value: raffle.prize_description },
                { label: 'Event', value: event.title },
              ]},
              extraLines: ['Contact the event organizer at the venue to collect your prize.'],
              ctaText: 'View My Tickets →',
              ctaUrl: getAppUrl('/my-tickets'),
              footerNote: 'See you on the dance floor! 🎶',
            }),
          })
        )
      );
      toast.success("Prize email has been resent to the winner.");
    } catch {
      toast.error("Failed to resend prize email. Please try again.");
    }
  };

  const deleteRaffle = async (id) => {
    await base44.entities.EventRaffle.delete(id);
    toast.success("Raffle removed");
    load();
  };

  if (loading) return <div className="py-6 flex justify-center"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h3 className="font-display font-bold text-lg">RAFFLES</h3>
          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-bold">
            {tickets.filter(t => t.status === "active" || t.status === "scanned").length} eligible holders
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)} className="gap-2">
          <Plus className="w-4 h-4" /> New Raffle
        </Button>
      </div>

      {showForm && (
        <div className="p-4 rounded-xl bg-card border border-yellow-400/20 space-y-3">
          <p className="font-mono text-xs text-yellow-400 font-bold uppercase tracking-wider">Create Raffle</p>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raffle Name</label>
            <Input
              placeholder="e.g. Grand Prize Draw"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-background border-border/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Number of Winners</label>
              <Input
                type="number"
                min="1"
                value={form.num_winners}
                onChange={(e) => setForm(f => ({ ...f, num_winners: e.target.value }))}
                className="bg-background border-border/50"
              />
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prize / What are you giving away?</label>
            <Input
              placeholder="e.g. VIP access, free merch, bottle service..."
              value={form.prize_description}
              onChange={(e) => setForm(f => ({ ...f, prize_description: e.target.value }))}
              className="bg-background border-border/50"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Description (shown on event page)</label>
            <Input
              placeholder="e.g. Win free tickets to our next party!"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="bg-background border-border/50"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={createRaffle}>Create Raffle</Button>
          </div>
        </div>
      )}

      {raffles.length === 0 && !showForm && (
        <p className="text-base text-muted-foreground text-center py-6 bg-card rounded-lg border border-border/50">
          No raffles yet. Create one to randomly reward ticket holders!
        </p>
      )}

      {raffles.map((raffle) => (
        <div key={raffle.id} className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  raffle.status === "drawn"
                    ? "text-yellow-400 bg-yellow-400/10"
                    : raffle.status === "cancelled"
                    ? "text-destructive bg-destructive/10"
                    : "text-primary bg-primary/10"
                }`}>{raffle.status}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {raffle.num_winners} winner{raffle.num_winners > 1 ? "s" : ""}
                  {raffle.prize_description ? ` · ${raffle.prize_description}` : ""}
                </span>
              </div>
              {raffle.description && (
                <p className="text-sm text-muted-foreground">{raffle.description}</p>
              )}
              {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="font-mono text-[10px] text-yellow-400 uppercase tracking-wider">Winners</p>
                  {raffle.winner_names.map((name, i) => (
                    <p key={i} className="text-xs flex items-center gap-1.5">
                      <Trophy className="w-3 h-3 text-yellow-400" />
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground font-mono">{raffle.winner_emails?.[i]}</span>
                    </p>
                  ))}
                  {raffle.drawn_at && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      Drawn {format(new Date(raffle.drawn_at), "MMM dd, yyyy 'at' h:mm a")}
                    </p>
                  )}
                  <button
                    onClick={() => resendWinnerEmail(raffle)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-mono text-primary hover:underline"
                  >
                    <Mail className="w-3 h-3" /> Resend Prize Email
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {raffle.status === "upcoming" && (
                <Button
                  size="sm"
                  onClick={() => drawWinners(raffle)}
                  disabled={drawing === raffle.id}
                  className="gap-2 bg-yellow-400 text-black hover:bg-yellow-300 font-bold"
                >
                  {drawing === raffle.id ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Shuffle className="w-4 h-4" />
                  )}
                  Draw
                </Button>
              )}
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => deleteRaffle(raffle.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}