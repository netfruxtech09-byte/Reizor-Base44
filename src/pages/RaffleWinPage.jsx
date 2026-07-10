import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import RaffleWinShare from "../components/events/RaffleWinShare";
import BackButton from "../components/shared/BackButton";
import { toast } from "sonner";

export default function RaffleWinPage() {
  const { raffleId } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = useState(null);
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [me, raffles] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.EventRaffle.filter({ id: raffleId }, null, 1),
      ]);
      setUser(me);
      const r = raffles[0] || null;
      setRaffle(r);
      if (r?.event_id) {
        const events = await base44.entities.Event.filter({ id: r.event_id }, null, 1);
        setEvent(events[0] || null);
      }
      setLoading(false);
    })();
  }, [raffleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Raffle not found</p>
          <BackButton label="Go Back" />
        </div>
      </div>
    );
  }

  const eventTitle = raffle.event_title || event?.title || "Unknown Event";
  const coverImage = event?.cover_image;
  const winnerName = user?.full_name || "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <BackButton className="self-start mb-2" />

      {/* Win Card */}
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-yellow-400/30 bg-card shadow-2xl">
        {/* Event Poster */}
        {coverImage ? (
          <div className="relative h-52 overflow-hidden">
            <img src={coverImage} alt={eventTitle} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white font-display font-black text-lg leading-tight truncate">{eventTitle}</p>
            </div>
          </div>
        ) : (
          <div className="h-52 bg-gradient-to-br from-yellow-400/20 to-primary/20 flex items-center justify-center">
            <Trophy className="w-16 h-16 text-yellow-400 opacity-60" />
          </div>
        )}

        {/* Win Details */}
        <div className="p-6 space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="font-display font-black text-2xl tracking-tight text-yellow-400">YOU WON!</h1>
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>

          {winnerName && (
            <p className="text-muted-foreground text-sm">Congratulations, <span className="font-bold text-foreground">{winnerName}</span>!</p>
          )}

          <div className="p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20 space-y-1">
            <p className="font-mono text-xs text-yellow-400 uppercase tracking-widest">Your Prize</p>
            <p className="font-display font-black text-3xl text-yellow-400">${raffle.credit_amount}</p>
            <p className="text-sm text-muted-foreground">Credit for a future <span className="font-semibold text-foreground">{raffle.organizer_name || "organizer"}</span> event</p>
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            🎊 Credit has been added to your account. Use it on your next ticket purchase!
          </p>

          <RaffleWinShare raffle={raffle} event={event} userName={winnerName} />

          <Button variant="outline" onClick={() => navigate("/my-tickets")} className="w-full border-border/50 text-sm">
            View My Tickets
          </Button>
        </div>
      </div>

      {/* Reizor branding */}
      <p className="mt-6 font-mono text-xs text-muted-foreground/40 tracking-widest uppercase">Powered by Reizor</p>
    </div>
  );
}