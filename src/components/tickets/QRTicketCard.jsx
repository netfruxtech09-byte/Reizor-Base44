import { useState, useEffect, useRef } from "react";
import { Calendar, MapPin, Check, X as XIcon, Tag, ShieldAlert, ArrowRightLeft, Clock, Pencil } from "lucide-react";
import MapDirectionLink from "@/components/shared/MapDirectionLink";
import ResellModal from "./ResellModal";
import TransferTicketModal from "./TransferTicketModal";
import TicketShareCard from "./TicketShareCard";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import QRCode from "qrcode";
import { safeShare } from "@/lib/mobileShare";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function QRTicketCard({ ticket, event, onRefresh, isPast = false }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showResell, setShowResell] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [cancellingTransfer, setCancellingTransfer] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Load transfer info if ticket is in transferred state
  useEffect(() => {
    if (ticket.status === "transferred") {
      // First check for pending transfer
      base44.entities.TicketTransfer.filter(
        { original_ticket_id: ticket.id, status: "pending" },
        null, 1
      ).then(res => {
        if (res[0]) {
          setPendingTransfer(res[0]);
        } else {
          // Check for claimed transfer
          base44.entities.TicketTransfer.filter(
            { original_ticket_id: ticket.id, status: "claimed" },
            null, 1
          ).then(claimed => setPendingTransfer(claimed[0] ? { ...claimed[0], isClaimed: true } : null)).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [ticket.id, ticket.status]);

  // Generate high-res QR as data URL (512px, no CSS scaling distortion)
  // Encodes JSON with ticket_id + ticket_code so scanners can look up by either field
  useEffect(() => {
    if (ticket.status === "active" && !isPast) {
      const qrPayload = JSON.stringify({
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code || "",
        qr_code: ticket.qr_code || "",
      });
      QRCode.toDataURL(qrPayload, {
        width: 512,
        margin: 3,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [ticket.id, ticket.ticket_code, ticket.qr_code, ticket.status]);

  const handleCancelTransfer = async () => {
    if (!pendingTransfer) return;
    setCancellingTransfer(true);
    await base44.entities.TicketTransfer.update(pendingTransfer.id, { status: "cancelled" });
    await base44.entities.Ticket.update(ticket.id, { status: "active" });
    toast.success("Transfer cancelled. Ticket restored to your wallet.");
    setCancellingTransfer(false);
    onRefresh?.();
  };

  const statusColors = {
    active: "text-primary bg-primary/10 border-primary/30",
    scanned: "text-accent bg-accent/10 border-accent/30",
    refunded: "text-destructive bg-destructive/10 border-destructive/30",
    cancelled: "text-muted-foreground bg-muted border-border",
    transferred: pendingTransfer?.isClaimed
      ? "text-green-400 bg-green-400/10 border-green-400/30"
      : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  };

  const statusIcons = {
    active: null,
    scanned: <Check className="w-3 h-3" />,
    refunded: <XIcon className="w-3 h-3" />,
    cancelled: <XIcon className="w-3 h-3" />,
    transferred: pendingTransfer?.isClaimed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />,
  };

  const statusLabels = {
    active: "active",
    scanned: "scanned",
    refunded: "refunded",
    cancelled: "cancelled",
    transferred: pendingTransfer?.isClaimed ? "Transferred" : "Transfer Pending",
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden transition-all">
      {/* Ticket Header */}
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-black text-lg tracking-tight truncate">
              {ticket.event_title}
            </h3>
            <p className="font-mono text-xs text-primary mt-1">{ticket.ticket_type_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isPast && (
              <span className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase text-muted-foreground bg-muted border-border">
                Past Event
              </span>
            )}
            {!(isPast && ticket.status === "active") && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-bold uppercase ${statusColors[ticket.status] || statusColors.cancelled}`}>
                {statusIcons[ticket.status]}
                {statusLabels[ticket.status] || ticket.status}
              </div>
            )}
          </div>
        </div>

        {event?.date && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-primary" />
              <span className="font-mono">{format(new Date(event.date), "MMM dd, yyyy")}</span>
            </div>
            {event.venue_name && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-accent" />
                <span>{event.venue_name}</span>
                <MapDirectionLink
                  venueName={event.venue_name}
                  city={event.city}
                  country={event.country}
                  latitude={event.latitude}
                  longitude={event.longitude}
                  compact
                  className="font-mono"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashed divider */}
      <div className="relative mx-4 sm:mx-6">
        <div className="border-t border-dashed border-border/50" />
        <div className="absolute -left-7 -top-3 w-6 h-6 rounded-full bg-background" />
        <div className="absolute -right-7 -top-3 w-6 h-6 rounded-full bg-background" />
      </div>

      {/* QR Code */}
      <div className="p-4 sm:p-6 flex flex-col items-center">
        {ticket.status === "active" && !isPast ? (
          <>
            <div className="bg-white p-4 rounded-xl inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ticket ${ticket.ticket_code}`}
                  width={220}
                  height={220}
                  style={{ display: "block", imageRendering: "pixelated" }}
                />
              ) : (
                <div className="w-[220px] h-[220px] flex items-center justify-center">
                  <div className="w-6 h-6 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <ShieldAlert className="w-3 h-3 text-primary shrink-0" />
              <p className="font-mono text-[10px] text-primary">Present this QR at the door · Valid for entry & resale</p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-2 tracking-wider">
              {ticket.ticket_code}
            </p>
          </>
        ) : ticket.status === "active" && isPast ? (
          <div className="w-40 h-40 sm:w-48 sm:h-48 flex flex-col items-center justify-center gap-2 bg-muted/50 border border-border/40 rounded-lg text-center p-3">
            <XIcon className="w-7 h-7 text-muted-foreground/50" />
            <p className="font-display font-bold text-xs text-muted-foreground">Event Passed</p>
            <p className="font-mono text-[10px] text-muted-foreground/70 tracking-wider">{ticket.ticket_code}</p>
          </div>
        ) : ticket.status === "transferred" ? (
          <>
            {pendingTransfer?.isClaimed ? (
              // Transfer was claimed by recipient
              <div className="w-40 h-40 sm:w-48 sm:h-48 flex flex-col items-center justify-center gap-2 bg-green-400/10 border border-green-400/20 rounded-lg text-center p-3">
                <Check className="w-7 h-7 text-green-400" />
                <p className="font-display font-bold text-xs text-green-400">Claimed by Recipient</p>
                <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                  → <span className="text-foreground">{pendingTransfer.to_email}</span>
                </p>
                <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                  Transfer complete
                </p>
              </div>
            ) : (
              // Transfer is still pending
              <div className="w-40 h-40 sm:w-48 sm:h-48 flex flex-col items-center justify-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-center p-3">
                <Clock className="w-7 h-7 text-yellow-400" />
                <p className="font-display font-bold text-xs text-yellow-400">Transfer Pending</p>
                {pendingTransfer && (
                  <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                    → <span className="text-foreground">{pendingTransfer.to_email}</span>
                  </p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                  Awaiting claim
                </p>
              </div>
            )}
            {/* Only show cancel/change if still pending (not yet claimed) */}
            {!pendingTransfer?.isClaimed && (
              <div className="flex gap-2 mt-3 w-full max-w-xs">
                <button
                  onClick={handleCancelTransfer}
                  disabled={cancellingTransfer}
                  className="flex-1 flex items-center justify-center gap-1.5 font-mono text-xs text-destructive border border-destructive/30 px-3 py-2 rounded-lg touch-manipulation active:opacity-70"
                >
                  <XIcon className="w-3 h-3" />
                  {cancellingTransfer ? "Cancelling..." : "Cancel"}
                </button>
                <button
                  onClick={async () => { await handleCancelTransfer(); setShowTransfer(true); }}
                  disabled={cancellingTransfer}
                  className="flex-1 flex items-center justify-center gap-1.5 font-mono text-xs text-accent border border-accent/30 px-3 py-2 rounded-lg touch-manipulation active:opacity-70"
                >
                  <Pencil className="w-3 h-3" /> Change Email
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center bg-muted rounded-lg">
            <p className="font-mono text-xs text-muted-foreground uppercase">{ticket.status}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <span className="font-mono text-xs text-muted-foreground">${ticket.price_paid?.toFixed(2)}</span>
            {ticket.is_resale && (
              <>
                <span className="font-mono text-[10px] text-primary ml-2 bg-primary/10 px-1.5 py-0.5 rounded">Resale</span>
                {ticket.resale_original_price > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground line-through ml-1">${ticket.resale_original_price?.toFixed(2)}</span>
                )}
              </>
            )}
          </div>
          {ticket.status === "active" && !isPast && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  const lines = [
                    `TICKET: ${ticket.event_title}`,
                    `Type: ${ticket.ticket_type_name}`,
                    `Code: ${ticket.ticket_code}`,
                    event?.date ? `Date: ${new Date(event.date).toLocaleDateString()}` : '',
                    event?.venue_name ? `Venue: ${event.venue_name}` : '',
                    event?.city ? `City: ${event.city}` : '',
                    `Price Paid: $${ticket.price_paid?.toFixed(2) || '0.00'}`,
                  ].filter(Boolean).join('\n');
                  safeShare({
                    title: `Ticket – ${ticket.event_title}`,
                    text: lines,
                    url: `${window.location.origin}/my-tickets`,
                  });
                }}
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground border border-border/50 px-2 py-1 rounded touch-manipulation active:opacity-70"
              >
                🍎 Wallet
              </button>
              {ticket.purchased_with_loyalty ? (
                <span className="flex items-center gap-1 font-mono text-[10px] text-amber-400 border border-amber-400/30 bg-amber-400/5 px-2 py-1 rounded">
                  🎁 Reward Ticket
                </span>
              ) : (
                <>
                  {ticket.is_listed_for_resale ? (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-primary border border-primary/30 bg-primary/5 px-2 py-1 rounded">
                      <Tag className="w-3 h-3" /> Listed
                    </span>
                  ) : detectIsIOS() ? null : (
                    <button
                      onClick={() => setShowResell(true)}
                      className="flex items-center gap-1 font-mono text-[10px] text-primary border border-primary/30 px-2 py-1 rounded touch-manipulation active:opacity-70 hover:bg-primary/10 transition-colors"
                    >
                      <Tag className="w-3 h-3" /> Resell
                    </button>
                  )}
                  <button
                    onClick={() => setShowTransfer(true)}
                    className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground border border-border/50 px-2 py-1 rounded touch-manipulation active:opacity-70"
                  >
                    <ArrowRightLeft className="w-3 h-3" /> Transfer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {/* Branded share graphic — only for active upcoming tickets */}
        {ticket.status === "active" && !isPast && (
          <TicketShareCard ticket={ticket} event={event} userName={currentUser?.full_name || ""} />
        )}
      </div>

      <ResellModal
        ticket={ticket}
        event={event}
        open={showResell}
        onClose={() => setShowResell(false)}
        onListed={onRefresh || (() => {})}
      />
      {showTransfer && currentUser && (
        <TransferTicketModal
          ticket={ticket}
          event={event}
          user={currentUser}
          onClose={() => setShowTransfer(false)}
          onTransferred={onRefresh}
        />
      )}
    </div>
  );
}