import { useState, useEffect } from "react";
import { Gift, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ArtistRaffles() {
  const [artist, setArtist] = useState(null);
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      setArtist(artists[0]);
      const r = await base44.entities.ArtistRaffle.filter({ artist_id: artists[0].id }, "-created_date", 50);
      setRaffles(r);
      setLoading(false);
    });
  }, []);

  const drawWinners = async (raffle) => {
    const entries = raffle.entries || [];
    if (entries.length < raffle.num_winners) {
      toast.error("Not enough entries to draw winners");
      return;
    }
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, raffle.num_winners);
    await base44.entities.ArtistRaffle.update(raffle.id, {
      status: "drawn",
      winner_emails: winners.map(w => w.email),
      winner_names: winners.map(w => w.name),
      drawn_at: new Date().toISOString(),
    });
    setRaffles(r => r.map(x => x.id === raffle.id ? { ...x, status: "drawn", winner_names: winners.map(w => w.name), winner_emails: winners.map(w => w.email) } : x));

    // Send email + in-app notification to each winner
    console.log('[Raffle] Drawing winners for:', raffle.prize_title, '| winners:', winners.map(w => w.email));
    await Promise.all(winners.map(async (winner) => {
      if (!winner.email) {
        console.error('[Raffle] Winner has no email — skipping:', winner);
        return;
      }
      const emailPayload = {
        to: winner.email,
        subject: `🎉 You Won the Raffle!`,
        body: [
          `Hi ${winner.name || 'there'},`,
          ``,
          `Congratulations! 🎉 You have been selected as a winner!`,
          ``,
          `Raffle: ${raffle.prize_title}`,
          raffle.prize_description ? `Prize details: ${raffle.prize_description}` : null,
          ``,
          `The artist will contact you with next steps shortly.`,
          ``,
          `— Reizor`,
        ].filter(Boolean).join('\n'),
      };
      console.log('[Raffle] Sending winner email to:', winner.email, '| subject:', emailPayload.subject);
      try {
        await base44.integrations.Core.SendEmail(emailPayload);
        console.log('[Raffle] RAFFLE EMAIL SENT:', winner.email);
      } catch (err) {
        console.error('[Raffle] Winner email failed for:', winner.email, err.message);
        try {
          await base44.integrations.Core.SendEmail(emailPayload);
          console.log('[Raffle] Retry succeeded for:', winner.email);
        } catch (retryErr) {
          console.error('[Raffle] Retry also failed for:', winner.email, retryErr.message);
        }
      }
    }));

    toast.success(`${raffle.num_winners} winner(s) drawn and notified!`);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display font-black text-3xl tracking-tight">RAFFLES</h1>
      <p className="text-sm text-muted-foreground">Create raffles from the Posts page. Manage and draw winners here.</p>

      {raffles.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border/50">
          <Gift className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No raffles yet — create one from My Posts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {raffles.map((raffle) => (
            <div key={raffle.id} className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-lg">{raffle.prize_title}</p>
                  {raffle.prize_description && <p className="text-sm text-muted-foreground mt-0.5">{raffle.prize_description}</p>}
                </div>
                <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded shrink-0 ${
                  raffle.status === "active" ? "text-green-400 bg-green-400/10" :
                  raffle.status === "drawn" ? "text-primary bg-primary/10" :
                  "text-muted-foreground bg-muted"
                }`}>{raffle.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Entries</p>
                  <p className="font-bold text-base">{raffle.entries?.length || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Winners</p>
                  <p className="font-bold text-base">{raffle.num_winners}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Entry</p>
                  <p className="font-bold text-base capitalize">{raffle.entry_requirement}</p>
                </div>
              </div>

              {raffle.ends_at && (
                <p className="text-xs font-mono text-muted-foreground">
                  Ends: {format(new Date(raffle.ends_at), "MMM dd, yyyy h:mm a")}
                </p>
              )}

              {raffle.terms_and_conditions && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-mono text-primary hover:underline">View T&C</summary>
                  <p className="mt-2 whitespace-pre-wrap bg-muted rounded p-3">{raffle.terms_and_conditions}</p>
                </details>
              )}

              {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs font-mono text-primary font-bold mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" /> WINNERS</p>
                  {raffle.winner_names.map((name, i) => (
                    <p key={i} className="text-sm font-bold">{name} <span className="text-xs text-muted-foreground font-normal font-mono">({raffle.winner_emails?.[i]})</span></p>
                  ))}
                </div>
              )}

              {raffle.status === "active" && (
                <Button onClick={() => drawWinners(raffle)} className="w-full font-display font-bold gap-2" variant="outline">
                  <Trophy className="w-4 h-4" /> Draw Winners
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}