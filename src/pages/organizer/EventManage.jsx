import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import GuestListManager from "../../components/organizer/GuestListManager";
import SeatMapEditor from "../../components/events/SeatMapEditor";
import TableReservationManager from "../../components/organizer/TableReservationManager";
import TableCheckInProgress from "../../components/organizer/TableCheckInProgress";
import { ArrowLeft, Users, Ticket, DollarSign, ScanLine, Edit, XCircle, Trash2, Map, Copy } from "lucide-react";
import EventMarketingLinks from "../../components/organizer/EventMarketingLinks";
import MapDirectionLink from "../../components/shared/MapDirectionLink";
import WaitlistManager from "../../components/organizer/WaitlistManager";
import RaffleManager from "../../components/organizer/RaffleManager";
import GiveawayManager from "../../components/organizer/GiveawayManager";
import PollManager from "../../components/organizer/PollManager";
import CancelEventModal from "../../components/organizer/CancelEventModal";
import VendorManager from "../../components/organizer/VendorManager";
import RsvpApprovalManager from "../../components/organizer/RsvpApprovalManager";
import EventArtistAssignment from "../../components/organizer/EventArtistAssignment";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import StatCard from "../../components/shared/StatCard";
import EventFinancialsManager from "../../components/organizer/EventFinancialsManager";
import ResellListingsPanel from "../../components/organizer/ResellListingsPanel";
import OrganizerPromoManager from "../../components/organizer/OrganizerPromoManager";
import PromoterLinksSection from "../../components/organizer/PromoterLinksSection";
import { isEventPast } from "@/utils/eventUtils";

export default function EventManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // "cancel" | "delete" | null
  const [seatMap, setSeatMap] = useState(null);
  const [showSeatMapEditor, setShowSeatMapEditor] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Call cleanup on load to ensure expired orders are updated
    base44.functions.invoke('cleanupExpiredOrders', {}).catch(() => {});
    
    // Load user + core data together so admin-bypass status is known before first render
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Event.filter({ id }, null, 1).catch(() => []),
      base44.entities.Ticket.filter({ event_id: id }, "-created_date", 200).catch(() => []),
      base44.entities.Order.filter({ event_id: id }, "-created_date", 200).catch(() => []),
    ]).then(([u, evs, tks, ords]) => {
      setUser(u);
      setEvent(evs[0]);
      setTickets(tks);
      setOrders(ords);
      setLoading(false);
      // Load secondary data after main render
      Promise.all([
        base44.entities.TicketType.filter({ event_id: id }, "sort_order", 50).catch(() => []),
        base44.entities.SeatMap.filter({ event_id: id }, null, 1).catch(() => []),
      ]).then(([tts, sms]) => {
        setTicketTypes(tts);
        setSeatMap(sms[0] || null);
      });
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return <p className="text-muted-foreground py-20 text-center">Event not found</p>;

  const isPast = isEventPast(event);
  const isCancelled = event.status === "cancelled";
  const isAdmin = user?.role === "admin";
  // Locked = organizer management actions disabled. Admins always bypass this.
  const locked = !isAdmin && (isPast || isCancelled);

  // Revenue = completed orders only (exclude pending, expired, failed, cancelled)
  const revenue = orders.filter(o => o.status === "completed").reduce((s, o) => s + (o.total || 0), 0);
  
  // Pending orders = only those pending AND not expired (event hasn't finished)
  const pendingCount = orders.filter(o => ['pending', 'failed'].includes(o.status)).length;
  // "Tickets Sold" = active + scanned (excludes refunded, cancelled, transferred)
  const soldTickets = tickets.filter(t => t.status === "active" || t.status === "scanned");
  const scannedCount = tickets.filter(t => t.status === "scanned").length;
  const activeCount = tickets.filter(t => t.status === "active").length;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden mobile-bottom-nav-spacing">
      <Link to="/organizer/events" className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to events
      </Link>

      {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
           <div className="flex items-start gap-2 mb-1 flex-wrap">
            <h1 className="font-display font-black text-xl sm:text-3xl tracking-tight break-words">{event.title}</h1>
            <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${
              isCancelled ? "text-destructive bg-destructive/10" :
              isPast ? "text-muted-foreground bg-muted" :
              event.status === "published" ? "text-green-400 bg-green-400/10" :
              "text-muted-foreground bg-muted"
            }`}>{isCancelled ? "Cancelled" : isPast ? "Event Ended" : event.status}</span>
          </div>
          <p className="text-sm text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
            <span>{event.date ? format(new Date(event.date), "MMM dd, yyyy") : "No date"} · {event.venue_name}</span>
            <MapDirectionLink
              venueName={event.venue_name}
              address={event.venue_address}
              city={event.city}
              country={event.country}
              latitude={event.latitude}
              longitude={event.longitude}
              compact
              className="text-xs"
            />
          </p>
        </div>
         <div className="flex gap-2 flex-wrap sm:flex-nowrap">
           {locked ? (
             <Button size="sm" variant="outline" className="flex-1 sm:flex-none gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
               onClick={() => navigate(`/organizer/create?clone_from=${event.id}`)}>
               <Copy className="w-3.5 h-3.5" /> Reuse Event
             </Button>
           ) : (
             <>
               <Button size="sm" variant="outline" className="flex-1 sm:flex-none gap-1.5"
                 onClick={() => navigate(`/organizer/events/${event.id}/edit`)}>
                 <Edit className="w-3.5 h-3.5" /> <span className="sm:inline">Edit</span>
               </Button>
               {event.status !== "cancelled" && (
                 <Button size="sm" variant="outline"
                   className="flex-1 sm:flex-none gap-1.5 border-yellow-500/40 text-yellow-400 hover:bg-yellow-400/10"
                   onClick={() => setModalMode("cancel")}>
                   <XCircle className="w-3.5 h-3.5" /> <span className="sm:inline">Cancel</span>
                 </Button>
               )}
               <Button size="sm" variant="outline"
                 className="flex-1 sm:flex-none gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                 onClick={() => setModalMode("delete")}>
                 <Trash2 className="w-3.5 h-3.5" /> <span className="sm:inline">Delete</span>
               </Button>
             </>
           )}
         </div>
        </div>

      {event.status === "cancelled" && event.cancellation_note && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <span className="font-bold">Cancellation note:</span> {event.cancellation_note}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} accent />
        <StatCard label="Tickets Sold" value={soldTickets.length} icon={Ticket} />
        <StatCard label="Checked In" value={scannedCount} icon={ScanLine} />
        <StatCard label="Pending Entry" value={activeCount} icon={Users} />
      </div>

      {/* Locked event notice — organizers only, admins bypass */}
      {locked && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive font-mono">
          ⚠️ This event is {isCancelled ? "cancelled" : "ended"}. Management actions are disabled.
          {isPast && <> Use <span className="text-primary font-bold">Reuse Event</span> to create a new event based on this one.</>}
        </div>
      )}

      {/* Marketing Links — active events only */}
      {!locked && <EventMarketingLinks eventId={id} event={event} />}

      {/* Artist Assignment — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <EventArtistAssignment event={event} user={user || {}} />
        </div>
      )}

      {/* Seat Map — active events only */}
      {!locked && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-lg flex items-center gap-2"><Map className="w-4 h-4 text-primary" /> SEAT MAP</h2>
              <p className="text-sm text-muted-foreground">{seatMap ? `${seatMap.sections?.length || 0} sections configured` : "No seat map yet — design your venue layout"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowSeatMapEditor(o => !o)} className="gap-2">
              <Map className="w-3.5 h-3.5" /> {showSeatMapEditor ? "Hide Editor" : seatMap ? "Edit Seat Map" : "Create Seat Map"}
            </Button>
          </div>
          {showSeatMapEditor && (
            <div className="p-5 rounded-xl bg-card border border-border/50">
              <SeatMapEditor
                eventId={id}
                eventTitle={event.title}
                existingSeatMap={seatMap}
                onSaved={() => {
                  base44.entities.SeatMap.filter({ event_id: id }, null, 1).then(maps => {
                    setSeatMap(maps[0] || null);
                    setShowSeatMapEditor(false);
                  });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Guest List — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <GuestListManager event={event} />
        </div>
      )}

      {/* Financials — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <EventFinancialsManager event={event} />
        </div>
      )}

      {/* Raffles — active events only */}
      {!locked && <RaffleManager event={event} tickets={tickets} />}

      {/* Giveaway — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <GiveawayManager event={event} />
        </div>
      )}

      {/* Polls — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <PollManager event={event} isOrganizer={true} />
        </div>
      )}

      {/* Table Check-In Progress */}
      <TableCheckInProgress eventId={id} />

      {/* Table Reservations */}
      <div>
        <h2 className="font-display font-bold text-lg mb-1">TABLE RESERVATIONS</h2>
        <p className="text-sm text-muted-foreground mb-4">View and assign guest names to reserved tables</p>
        <TableReservationManager eventId={id} />
      </div>

      {/* Ticket Sellers / Affiliates — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <VendorManager event={event} ticketTypes={ticketTypes} />
        </div>
      )}

      {/* RSVP Approvals — active RSVP events only */}
      {!locked && event.event_type === "rsvp_only" && (
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <RsvpApprovalManager event={event} />
        </div>
      )}

      {/* Promo Codes — active events only */}
      {!locked && (
        <div className="p-5 rounded-xl bg-yellow-900/20 border-2 border-yellow-600/50">
          <OrganizerPromoManager event={event} ticketTypes={ticketTypes} />
        </div>
      )}

      {/* Promoter Links — active events only */}
      {!locked && (
        <PromoterLinksSection links={event.promoter_links || []} eventId={id} onChange={async (links) => {
          await base44.entities.Event.update(id, { promoter_links: links });
          setEvent(e => ({ ...e, promoter_links: links }));
        }} />
      )}

      {/* Resell Listings */}
      <div className="p-5 rounded-xl bg-card border border-border/50">
        <ResellListingsPanel eventId={id} />
      </div>

      {/* Waitlist — active events only */}
      {!locked && (
        <div>
          <h2 className="font-display font-bold text-lg mb-4">WAITLIST</h2>
          <WaitlistManager event={event} />
        </div>
      )}

      {/* Attendee List */}
      <div>
        <h2 className="font-display font-bold text-lg mb-4">ATTENDEES</h2>
        {soldTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center bg-card rounded-lg border border-border/50">
            No tickets sold yet
          </p>
        ) : (
          <div className="bg-card rounded-lg border border-border/50 overflow-x-auto">
             <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Code</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {soldTickets.map(ticket => (
                    <tr key={ticket.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{ticket.owner_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{ticket.owner_email}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{ticket.ticket_type_name}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{ticket.ticket_code}</td>
                      <td className="p-3">
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          ticket.status === "active" ? "text-primary bg-primary/10" :
                          ticket.status === "scanned" ? "text-accent bg-accent/10" :
                          "text-muted-foreground bg-muted"
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
                </div>
        )}
      </div>

      {/* Cancel / Delete Modal — active events only */}
      {!locked && modalMode && (
        <CancelEventModal
          event={event}
          tickets={tickets}
          orders={orders}
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onDone={() => {
            if (modalMode === "delete") {
              navigate("/organizer/events");
            } else {
              setEvent(e => ({ ...e, status: "cancelled" }));
              setModalMode(null);
            }
          }}
        />
      )}
    </div>
  );
}