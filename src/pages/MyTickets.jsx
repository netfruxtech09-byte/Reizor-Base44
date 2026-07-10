import { useState, useEffect } from "react";
import { Ticket, Calendar, Coins, AlertTriangle, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/shared/BackButton";
import { Button } from "@/components/ui/button";
import PullToRefresh from "@/components/shared/PullToRefresh";
import GuestNamesEditor from "../components/tickets/GuestNamesEditor";
import TableReservationCard from "../components/tickets/TableReservationCard";
import MyGiveawayWins from "../components/tickets/MyGiveawayWins";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRTicketCard from "../components/tickets/QRTicketCard";

export default function MyTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState({});
  const [credits, setCredits] = useState([]);
  const [tableReservations, setTableReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingCredit, setClaimingCredit] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // If coming from a giveaway win notification, highlight the wins section
  const highlightWins = new URLSearchParams(window.location.search).get("tab") === "wins";

  const load = async () => {
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        setLoading(false);
        return;
      }
      if (user.role === "admin") {
        setIsAdmin(true);
        setLoading(false);
        return;
      }
      setUserEmail(user.email);
      const myTickets = await base44.entities.Ticket.filter(
        { owner_email: user.email },
        "-created_date",
        100
      );
      setTickets(myTickets);

      // Load table reservations + their orders for full pricing breakdown
      const myReservations = await base44.entities.TableReservation.filter({ buyer_email: user.email }, '-created_date', 50).catch(() => []);

      // Enrich reservations with their Order data (for full price breakdown)
      const enrichedReservations = await Promise.all(
        myReservations.map(async (r) => {
          if (!r.order_id) return r;
          const orders = await base44.entities.Order.filter({ id: r.order_id }, null, 1).catch(() => []);
          return orders[0] ? { ...r, _order: orders[0] } : r;
        })
      );
      setTableReservations(enrichedReservations);

      // Load event details
      const reservationEventIds = myReservations.map(r => r.event_id).filter(Boolean);
      const eventIds = [...new Set([...myTickets.map((t) => t.event_id), ...reservationEventIds])];
      const eventsMap = {};
      for (const eid of eventIds) {
        const evs = await base44.entities.Event.filter({ id: eid }, null, 1);
        if (evs[0]) eventsMap[eid] = evs[0];
      }
      setEvents(eventsMap);

      // Load organizer credits
      const myCredits = await base44.entities.OrganizerCredit.filter({ user_email: user.email }, "-created_date", 50);
      setCredits(myCredits);

      // Auto-issue credit for tickets where event has passed & ticket is still active & no listing sold
      const now = new Date();
      for (const t of myTickets) {
        const ev = eventsMap[t.event_id];
        if (!ev || t.status !== "active") continue;
        const eventDate = new Date(ev.date);
        if (eventDate > now) continue; // event hasn't happened yet
        // Check if already credited
        const already = myCredits.find((c) => c.source_ticket_id === t.id);
        if (already) continue;
        // If ticket was purchased with credit, forfeit — no new credit issued
        if (t.paid_with_credit) {
          await base44.entities.Ticket.update(t.id, { status: "cancelled" });
          continue;
        }
        // Issue credit
        await base44.entities.OrganizerCredit.create({
          user_email: user.email,
          organizer_id: ev.organizer_id,
          organizer_name: ev.organizer_name || "Organizer",
          amount: t.price_paid || 0,
          source_event_id: ev.id,
          source_event_title: ev.title,
          source_ticket_id: t.id,
          note: "Auto-issued: event passed, ticket unused",
        });
        await base44.entities.Ticket.update(t.id, { status: "cancelled" });
      }

      setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const upcomingTickets = tickets.filter((t) => {
    const eventDate = events[t.event_id]?.date ? new Date(events[t.event_id].date) : null;
    const isActiveOrTransferred = t.status === "active" || t.status === "transferred";
    return isActiveOrTransferred && eventDate && eventDate > now;
  });
  const pastTickets = tickets.filter((t) => {
    const eventDate = events[t.event_id]?.date ? new Date(events[t.event_id].date) : null;
    const isActiveOrTransferred = t.status === "active" || t.status === "transferred";
    return !eventDate || eventDate <= now || !isActiveOrTransferred;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Admin accounts don't hold tickets — this is a fan-only page
  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="font-display font-black text-2xl">Not Available for Admins</h1>
          <p className="text-muted-foreground text-sm">My Tickets is a fan-only page. Admin accounts don't hold tickets.</p>
          <Button onClick={() => navigate("/admin")} className="w-full font-display font-bold glow-lime">
            Go to Admin Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Not logged in — show login prompt
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="text-5xl mb-2">🎟️</div>
          <h1 className="font-display font-black text-2xl">My Tickets</h1>
          <p className="text-muted-foreground text-sm">Please sign in to view your tickets.</p>
          <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname)} className="w-full font-display font-bold glow-lime">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={load} className="min-h-screen">
    <div className="py-8 px-4 sm:px-6 max-w-3xl mx-auto">
      <BackButton to="/" label="Home" />
      <div className="mb-8">
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ YOUR PASSES</span>
        <h1 className="font-display font-black text-4xl tracking-tight mt-1">MY TICKETS</h1>
      </div>

      {tableReservations.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="font-display font-bold text-lg">TABLE RESERVATIONS</h2>
          {tableReservations.map(r => (
            <TableReservationCard key={r.id} reservation={r} event={events[r.event_id]} />
          ))}
        </div>
      )}

      {tickets.length === 0 && tableReservations.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-display font-bold text-xl text-muted-foreground mb-2">No tickets yet</p>
          <p className="text-sm text-muted-foreground">Browse events and grab your first tickets</p>
        </div>
      ) : tickets.length > 0 ? (
        <>
          <GuestNamesEditor userEmail={userEmail} />

          <MyGiveawayWins userEmail={userEmail} highlight={highlightWins} />

          {credits.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-accent" />
                <h3 className="font-display font-bold text-sm">ORGANIZER CREDITS</h3>
              </div>
              <div className="space-y-2">
                {credits.map((c) => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-medium">{c.organizer_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.source_event_title}</p>
                    </div>
                    <span className="font-mono font-black text-accent">${c.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Credits can be applied when purchasing tickets from the same organizer.
              </p>
            </div>
          )}

          <Tabs defaultValue="active">
            <TabsList className="bg-card border border-border/50 mb-6">
             <TabsTrigger value="active" className="gap-2 font-display font-bold">
               <Ticket className="w-3.5 h-3.5" /> Upcoming ({upcomingTickets.length})
             </TabsTrigger>
              <TabsTrigger value="past" className="gap-2 font-display font-bold">
                <Calendar className="w-3.5 h-3.5" /> Past ({pastTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <div className="space-y-4">
                {upcomingTickets.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No upcoming tickets</p>
                ) : (
                  upcomingTickets.map((ticket) => (
                    <QRTicketCard key={ticket.id} ticket={ticket} event={events[ticket.event_id]} onRefresh={load} />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="past">
              <div className="space-y-4">
                {pastTickets.map((ticket) => (
                  <QRTicketCard key={ticket.id} ticket={ticket} event={events[ticket.event_id]} onRefresh={load} isPast />
                ))}
                {pastTickets.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No past tickets</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
    </PullToRefresh>
  );
}