import { useState, useEffect, useRef } from "react";
import { Gift, Trophy, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

function RedeemBadge({ status }) {
  if (status === "redeemed") {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-400/10 text-green-400">
        <CheckCircle2 className="w-3 h-3" /> Redeemed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400">
      <Clock className="w-3 h-3" /> Not Redeemed
    </span>
  );
}

export default function MyGiveawayWins({ userEmail, highlight = false }) {
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const sectionRef = useRef(null);

  // Auto-scroll into view when coming from a notification link
  useEffect(() => {
    if (highlight && sectionRef.current && !loading) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [highlight, loading]);

  const load = async () => {
    setLoading(true);
    // Fetch all drawn giveaways — then filter client-side for this user's wins
    const allDrawn = await base44.entities.EventGiveaway.filter({ status: "drawn" }, "-drawn_at", 200).catch(() => []);
    const myWins = [];
    allDrawn.forEach(g => {
      (g.winners || []).forEach(w => {
        if (w.winner_email === userEmail) {
          myWins.push({ giveaway: g, winner: w });
        }
      });
    });
    setWins(myWins);
    setLoading(false);
  };

  useEffect(() => {
    if (userEmail) load();
  }, [userEmail]);

  const handleRedeem = async ({ giveaway, winner }) => {
    if (winner.redeem_status === "redeemed") {
      toast.error("This prize has already been redeemed.");
      return;
    }
    setRedeeming(`${giveaway.id}-${winner.item_subject}`);

    const redeemedAt = new Date().toISOString();
    const redeemCode = `RDM-${giveaway.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Update the specific winner record inside the winners array
    const updatedWinners = (giveaway.winners || []).map(w => {
      if (w.winner_email === winner.winner_email && w.item_subject === winner.item_subject) {
        return { ...w, redeem_status: "redeemed", redeemed_at: redeemedAt, redeemed_by: userEmail, redeem_code: redeemCode };
      }
      return w;
    });

    await base44.entities.EventGiveaway.update(giveaway.id, { winners: updatedWinners });
    toast.success(`🎉 Prize claimed! Your redeem code: ${redeemCode}`);
    setRedeeming(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (wins.length === 0) return null;

  return (
    <div className="mb-6" ref={sectionRef}>
      <div className={`flex items-center gap-2 mb-3 ${highlight ? "animate-pulse" : ""}`}>
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h2 className="font-display font-bold text-lg">MY GIVEAWAY WINS</h2>
        <span className="font-mono text-[10px] bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded font-bold">
          {wins.length} prize{wins.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {wins.map(({ giveaway, winner }, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-card border border-yellow-400/20 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-3.5 h-3.5 text-primary/70" />
                  <span className="font-bold text-sm">{winner.item_subject}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{giveaway.event_title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Won: {giveaway.drawn_at ? format(new Date(giveaway.drawn_at), "MMM d, yyyy h:mm a") : "—"}
                </p>
              </div>
              <RedeemBadge status={winner.redeem_status} />
            </div>

            {winner.redeem_status === "redeemed" ? (
              <div className="p-2 rounded bg-green-400/5 border border-green-400/20 text-xs font-mono">
                <span className="text-muted-foreground">Redeem Code: </span>
                <span className="text-green-400 font-bold">{winner.redeem_code}</span>
                <span className="block text-muted-foreground mt-0.5">
                  Redeemed: {winner.redeemed_at ? format(new Date(winner.redeemed_at), "MMM d, yyyy h:mm a") : "—"}
                </span>
                <p className="text-muted-foreground mt-1">Show this code to the event organizer to collect your prize.</p>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => handleRedeem({ giveaway, winner })}
                disabled={redeeming === `${giveaway.id}-${winner.item_subject}`}
                className="gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold w-full"
              >
                {redeeming === `${giveaway.id}-${winner.item_subject}`
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trophy className="w-3.5 h-3.5" />}
                Claim Prize
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}