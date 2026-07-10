import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, Download, Ticket, Share2, Calendar, MapPin, Users, Loader2, Tag } from "lucide-react";
import MapDirectionLink from "@/components/shared/MapDirectionLink";
import BackButton from "@/components/shared/BackButton";
import ResellModal from "@/components/tickets/ResellModal";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { safeDownloadImage, safeShare, isAndroid, isIOS } from "@/lib/mobileShare";
import { hapticSuccess, hapticMedium } from "@/lib/haptics";
import { formatPrice } from "@/utils/currency";

function TicketQR({ ticket }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    if (ticket.status === "active") {
      const qrPayload = JSON.stringify({
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code || "",
        qr_data: ticket.qr_data || ticket.ticket_code || "",
      });
      QRCode.toDataURL(qrPayload, {
        width: 512,
        margin: 3,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [ticket.id, ticket.ticket_code, ticket.status]);

  if (ticket.status !== "active") {
    return (
      <div className="w-40 h-40 flex items-center justify-center bg-muted rounded-lg">
        <p className="font-mono text-xs text-muted-foreground uppercase">{ticket.status}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl inline-block">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR code for ${ticket.ticket_code}`}
          width={200}
          height={200}
          style={{ display: "block", imageRendering: "pixelated" }}
        />
      ) : (
        <div className="w-[200px] h-[200px] flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [tableReservation, setTableReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showResellModal, setShowResellModal] = useState(null);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  const loadData = async () => {
    // Ensure user is authenticated before querying — RLS requires owner_email match
    const user = await base44.auth.me().catch(() => null);

    const o = await base44.entities.Order.filter({ id: orderId }, null, 1);
    if (!o[0]) throw new Error("Order not found");
    setOrder(o[0]);

    // Clear any pending checkout state now that order is confirmed
    sessionStorage.removeItem("pending_checkout");
    sessionStorage.removeItem("pending_table_checkout");
    localStorage.removeItem("pending_checkout_intent");

    const [ev, tix, tableRes] = await Promise.all([
      base44.entities.Event.filter({ id: o[0].event_id }, null, 1),
      // Only query tickets if authenticated (RLS will block unauthenticated reads)
      user
        ? base44.entities.Ticket.filter({ order_id: orderId }).catch(() => [])
        : Promise.resolve([]),
      base44.entities.TableReservation.filter({ order_id: orderId }, null, 1).catch(() => []),
    ]);
    if (ev[0]) setEvent(ev[0]);
    setTickets(tix || []);
    const tr = tableRes[0] || null;
    if (tr) setTableReservation(tr);
    return { order: o[0], tickets: tix || [], tableReservation: tr, isAuthed: !!user };
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { order: o, tickets: tix, tableReservation: tr } = await loadData();

        // Poll if order still pending, no tickets yet, or auth wasn't ready on first load
        const confirmed = o.status === "completed" && (tix.length > 0 || !!tr);
        if (confirmed) {
          hapticSuccess();
        } else {
          setPolling(true);
          pollRef.current = setInterval(async () => {
            pollCountRef.current += 1;
            try {
              const { order: refreshed, tickets: freshTix, tableReservation: freshTable } = await loadData();
              if (refreshed.status === "completed" && (freshTix.length > 0 || freshTable)) {
                hapticSuccess();
                clearInterval(pollRef.current);
                setPolling(false);
              }
            } catch {}
            // Poll for up to 30 attempts (75 seconds) to handle webhook delay + auth restore
            if (pollCountRef.current >= 30) {
              clearInterval(pollRef.current);
              setPolling(false);
            }
          }, 2500);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => clearInterval(pollRef.current);
  }, [orderId]);

  const downloadTickets = async () => {
    const element = document.getElementById("tickets-download-area");
    if (!element) { toast.error("Ticket area not found. Please wait for tickets to load."); return; }
    hapticMedium();
    setDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#0d1024",
        useCORS: true,
        allowTaint: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const eventName = (event?.title || order?.event_title || "ticket").replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const fileName = `reizor-ticket-${eventName}-${order?.order_number || orderId}.png`;
      const result = await safeDownloadImage(dataUrl, fileName, {
        title: `Ticket – ${event?.title || order?.event_title}`,
        text: "My event ticket from Reizor",
        url: `${window.location.origin}/my-tickets`,
      });
      // safeDownloadImage already shows success/error toasts internally.
      // Only show extra error if it silently failed without feedback.
      if (!result?.success && result?.reason !== "aborted" && result?.method !== "clipboard_fallback") {
        toast.error("Download failed. Please try Share instead.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Download failed. Please try again.");
    }
    setDownloading(false);
  };

  const shareTickets = async () => {
    hapticMedium();
    setSharing(true);
    const eventTitle = event?.title || order?.event_title || "Event";
    const eventDate = event?.date
      ? new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : "";
    const ticketTypes = [...new Set(tickets.map(t => t.ticket_type_name).filter(Boolean))].join(", ");
    const ticketUrl = `${window.location.origin}/my-tickets`;
    const shareText = [
      `🎟 My ticket for ${eventTitle}`,
      eventDate ? `📅 ${eventDate}` : "",
      event?.venue_name ? `📍 ${event.venue_name}${event.city ? `, ${event.city}` : ""}` : "",
      ticketTypes ? `🎫 ${ticketTypes}` : "",
    ].filter(Boolean).join("\n");
    await safeShare({ title: `Ticket – ${eventTitle}`, text: shareText, url: ticketUrl });
    setSharing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Button onClick={() => navigate("/my-tickets")}>View My Tickets</Button>
        </div>
      </div>
    );
  }

  const buyerEmail = order.customer_email || order.buyer_email || "";
  const isTableOrder = !!tableReservation;
  const currency = event?.currency || order?.currency || "USD";

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-3xl mx-auto">
      <BackButton to="/my-tickets" label="My Tickets" />

      {/* Success Banner */}
      <div className="mb-8 p-6 rounded-xl bg-green-500/10 border border-green-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl">
              {isTableOrder ? "TABLE RESERVED!" : "ORDER CONFIRMED!"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTableOrder ? "Your table booking is confirmed" : "Your tickets are ready"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <p className="text-muted-foreground">Order: <span className="font-mono font-bold text-foreground">{order.order_number || orderId}</span></p>
          {order.status === "completed" && (
            <span className="font-mono text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded uppercase">Paid</span>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 p-5 rounded-xl bg-card border border-border/50">
          <h2 className="font-display font-bold text-lg mb-4">EVENT DETAILS</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Event</p>
              <p className="font-bold text-lg">{event?.title || order.event_title}</p>
            </div>
            <div className="flex flex-wrap gap-4 pt-3 border-t border-border/50">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">
                    {event?.date
                      ? new Date(event.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
                      : "N/A"}
                  </p>
                  {event?.doors_open && (
                    <p className="text-xs text-muted-foreground font-mono">Doors: {event.doors_open}</p>
                  )}
                </div>
              </div>
              {(event?.venue_name || event?.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{event?.venue_name || [event?.city, event?.country].filter(Boolean).join(", ")}</p>
                    <MapDirectionLink
                      venueName={event?.venue_name}
                      city={event?.city}
                      country={event?.country}
                      latitude={event?.latitude}
                      longitude={event?.longitude}
                      className="text-xs font-mono mt-0.5"
                      compact
                    />
                  </div>
                </div>
              )}
              {!isTableOrder && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tickets</p>
                    <p className="text-sm font-medium">{tickets.length || order.quantity || "—"}</p>
                  </div>
                </div>
              )}
              {isTableOrder && tableReservation.table_name && (
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">🪑</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Table</p>
                    <p className="text-sm font-medium">{tableReservation.table_name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-primary/10 border border-primary/30">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">Total Paid</p>
          <p className="font-display font-black text-3xl text-primary mb-4">{formatPrice(order.total || 0, currency)}</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal || 0, currency)}</span>
            </div>
            {(order.service_fee || 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service Fee</span>
                <span>{formatPrice(order.service_fee || 0, currency)}</span>
              </div>
            )}
            {(order.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discount</span>
                <span>-{formatPrice(order.discount_amount || 0, currency)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-primary/20 flex justify-between font-bold text-sm">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total || 0, currency)}</span>
          </div>
        </div>
      </div>

      {/* Table Reservation Card */}
      {isTableOrder && (
        <div className="mb-8 space-y-4">
          <h2 className="font-display font-bold text-lg">YOUR TABLE RESERVATION</h2>
          <div
            className="rounded-xl overflow-hidden border border-border/50"
            style={{ background: "linear-gradient(135deg, #0d1024 0%, #151b35 100%)" }}
          >
            <div className="p-5 border-b border-border/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Table Reserved</p>
                  <p className="font-display font-bold text-lg">{tableReservation.table_name || "VIP Table"}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{event?.title || order.event_title}</p>
                </div>
                <span className="text-2xl">🪑</span>
              </div>
              {event?.date && (
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary" />
                    {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {event.doors_open ? ` · Doors ${event.doors_open}` : ""}
                  </span>
                  {event?.venue_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-accent" />
                      {event.venue_name}{event.city ? `, ${event.city}` : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Booking Status</p>
                <p className="font-mono font-bold text-green-400">CONFIRMED</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Booking Ref</p>
                <p className="font-mono font-bold text-foreground text-[11px] break-all">{order.order_number || orderId}</p>
              </div>
              {tableReservation.buyer_name && (
                <div>
                  <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Booked By</p>
                  <p className="font-mono font-bold text-foreground">{tableReservation.buyer_name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Payment</p>
                <p className="font-mono font-bold text-primary">PAID · {formatPrice(order.total || 0, currency)}</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <p className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1 text-center">
                Show this confirmation at the venue for your table
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/my-tickets")} size="lg" className="w-full font-display font-bold glow-lime">
            View My Bookings
          </Button>
        </div>
      )}

      {/* Tickets (only for ticket orders) */}
      {!isTableOrder && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">YOUR TICKETS</h2>
            {polling && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                Waiting for confirmation…
              </div>
            )}
          </div>

          {tickets.length === 0 ? (
            <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
              {polling ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Processing your tickets, please wait…</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">This usually takes a few seconds after payment.</p>
                </>
              ) : (
                <>
                  <Ticket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm mb-3">Tickets are being prepared</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/my-tickets")}>Check My Tickets</Button>
                </>
              )}
            </div>
          ) : (
            <div id="tickets-download-area" className="space-y-4 p-4 bg-background rounded-xl">
              {tickets.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className="rounded-xl overflow-hidden border border-border/50"
                  style={{ background: "linear-gradient(135deg, #0d1024 0%, #151b35 100%)" }}
                >
                  <div className="p-5 border-b border-border/30">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Ticket {idx + 1} of {tickets.length}</p>
                        <p className="font-display font-bold text-lg">{ticket.ticket_type_name || "General Admission"}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{event?.title || order.event_title}</p>
                      </div>
                      <Ticket className="w-6 h-6 text-primary opacity-50 shrink-0" />
                    </div>
                    {event?.date && (
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary" />
                          {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          {event.doors_open ? ` · Doors ${event.doors_open}` : ""}
                        </span>
                        {event?.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-accent" />
                            {event.venue_name}{event.city ? `, ${event.city}` : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <TicketQR ticket={ticket} />
                      <p className="font-mono text-[10px] text-muted-foreground tracking-wider text-center">{ticket.ticket_code}</p>
                    </div>
                    <div className="flex-1 space-y-3 w-full">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Status</p>
                          <p className={`font-mono font-bold ${ticket.status === "active" ? "text-green-400" : "text-muted-foreground"}`}>
                            {ticket.status?.toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Ticket Type</p>
                          <p className="font-mono font-bold text-foreground">{ticket.ticket_type_name || "General Admission"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Ref #</p>
                          <p className="font-mono font-bold text-foreground text-[11px] break-all">{ticket.ticket_code}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Price Paid</p>
                          <p className="font-mono font-bold text-primary">{formatPrice(ticket.price_paid || 0, currency)}</p>
                        </div>
                        {ticket.owner_name && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground mb-0.5 font-mono uppercase tracking-wider text-[10px]">Ticket Holder</p>
                            <p className="font-mono font-bold text-foreground">{ticket.owner_name}</p>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-border/30 space-y-2">
                        <p className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1 text-center">
                          Present QR code at the door for entry
                        </p>
                        {ticket.status === "active" && !ticket.is_listed_for_resale && !(event?.date && new Date(event.date) < new Date()) && !isIOS() && (
                          <button
                            onClick={() => setShowResellModal(ticket.id)}
                            className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1 touch-manipulation active:opacity-70"
                          >
                            <Tag className="w-3 h-3" /> Resell Ticket
                          </button>
                        )}
                        {ticket.is_listed_for_resale && (
                          <p className="w-full text-center font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1">
                            🏷 Listed for resale
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ticket Actions */}
      {tickets.length > 0 && !isTableOrder && (() => {
        const eventEnded = event?.date ? new Date(event.date) < new Date() : false;
        const eligibleTicket = tickets.find(t =>
          t.status === "active" && !t.is_listed_for_resale && !eventEnded
        );
        return (
          <div className="flex flex-col sm:flex-row gap-3 mb-8 flex-wrap">
            <Button
              onClick={downloadTickets}
              disabled={downloading}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 font-display font-bold"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Saving…" : (isAndroid() || isIOS()) ? "Save Ticket" : "Download Ticket"}
            </Button>
            <Button
              onClick={shareTickets}
              disabled={sharing}
              variant="outline"
              size="lg"
              className="gap-2 flex-1 font-display font-bold"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {sharing ? "Sharing…" : "Share"}
            </Button>
            {eligibleTicket && !isIOS() && (
              <Button
                onClick={() => setShowResellModal(eligibleTicket.id)}
                variant="outline"
                size="lg"
                className="gap-2 flex-1 font-display font-bold border-primary/40 text-primary hover:bg-primary/10"
              >
                <Tag className="w-4 h-4" /> Resell Ticket
              </Button>
            )}
            <Button onClick={() => navigate("/my-tickets")} size="lg" className="gap-2 flex-1 font-display font-bold glow-lime">
              View All Tickets
            </Button>
          </div>
        );
      })()}

      {/* Info */}
      <div className="p-4 rounded-lg bg-card border border-border/50 text-sm text-muted-foreground text-center">
        {buyerEmail ? (
          <p>A confirmation email has been sent to <span className="font-mono font-bold text-foreground">{buyerEmail}</span></p>
        ) : (
          <p>A confirmation email has been sent to your registered email address.</p>
        )}
      </div>

      {/* Resell Modal */}
      {showResellModal && (
        <ResellModal
          ticket={tickets.find(t => t.id === showResellModal)}
          event={event}
          open={!!showResellModal}
          onClose={() => setShowResellModal(null)}
          onListed={() => {
            setShowResellModal(null);
            // Mark ticket as listed locally so UI updates without full reload
            setTickets(prev => prev.map(t =>
              t.id === showResellModal ? { ...t, is_listed_for_resale: true } : t
            ));
          }}
        />
      )}
      </div>
      );
      }