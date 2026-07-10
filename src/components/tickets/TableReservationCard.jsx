import { useEffect, useState } from "react";
import { Calendar, MapPin, ShieldAlert, Users } from "lucide-react";
import MapDirectionLink from "@/components/shared/MapDirectionLink";
import { format } from "date-fns";
import TableShareCard from "./TableShareCard";
import QRCode from "qrcode";

export default function TableReservationCard({ reservation, event }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const bookingCode = `TBL-${reservation.id?.slice(-8).toUpperCase()}`;

  useEffect(() => {
    if (reservation.id && reservation.status === "reserved") {
      QRCode.toDataURL(bookingCode, {
        width: 512,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [reservation.id, reservation.status]);

  const statusColors = {
    reserved: "text-primary bg-primary/10 border-primary/30",
    checked_in: "text-green-400 bg-green-400/10 border-green-400/30",
    cancelled: "text-muted-foreground bg-muted border-border",
  };

  // Derive pricing from the linked Order record (most accurate) or fall back to reservation fields
  // order.subtotal = actual table price (e.g. $50), order.service_fee = platform fee (e.g. $10)
  // order.tax = processing fee (Stripe), order.total = grand total charged
  const order = reservation._order;
  const tablePrice    = order?.subtotal ?? null;
  const serviceFee    = order?.service_fee ?? reservation.platform_fee ?? null;
  const processingFee = (order?.tax != null && order.tax > 0) ? order.tax : null;
  const totalPaid     = order?.total ?? reservation.total_price ?? null;

  const fmt = (v) => (v != null ? `$${Number(v).toFixed(2)}` : "—");

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/20 transition-all">

      {/* Header */}
      <div className="p-4 sm:p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-black text-lg tracking-tight leading-snug">
              {reservation.event_title || event?.title}
            </h3>
            <p className="font-mono text-xs text-primary mt-1">🪑 {reservation.table_name || "Table"} — Table Reservation</p>
            {reservation.buyer_name && (
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                Guest: <span className="text-foreground font-medium capitalize">{reservation.buyer_name}</span>
              </p>
            )}
          </div>
          <span className={`shrink-0 px-2 py-1 rounded border text-[10px] font-mono font-bold uppercase ${statusColors[reservation.status] || statusColors.reserved}`}>
            {{ reserved: "Reserved", checked_in: "Checked In", cancelled: "Cancelled" }[reservation.status] || reservation.status}
          </span>
        </div>

        {/* Event meta */}
        {(event?.date || event?.venue_name) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {event?.date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-mono">{format(new Date(event.date), "MMM dd, yyyy")}</span>
              </div>
            )}
            {event?.venue_name && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{event.venue_name}{event.city ? `, ${event.city}` : ""}</span>
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

      {/* Ticket tear divider */}
      <div className="relative mx-4 sm:mx-6">
        <div className="border-t border-dashed border-border/50" />
        <div className="absolute -left-7 -top-3 w-6 h-6 rounded-full bg-background" />
        <div className="absolute -right-7 -top-3 w-6 h-6 rounded-full bg-background" />
      </div>

      {/* QR Code */}
      <div className="p-4 sm:p-6 flex flex-col items-center gap-3">
        {reservation.status === "reserved" ? (
          <>
            <div className="bg-white p-3 rounded-xl inline-block shadow-lg">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${bookingCode}`}
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
              <ShieldAlert className="w-3 h-3 text-yellow-400 shrink-0" />
              <p className="font-mono text-[10px] text-yellow-400">Show this QR at the door</p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider">{bookingCode}</p>
          </>
        ) : (
          <div className="w-[200px] h-[200px] flex items-center justify-center bg-muted rounded-lg">
            <p className="font-mono text-xs text-muted-foreground uppercase">{reservation.status}</p>
          </div>
        )}
      </div>

      {/* Details + Pricing */}
      <div className="px-4 sm:px-6 pb-5 space-y-3">

        {/* Booking details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3 sm:p-4 rounded-xl bg-secondary/50 border border-border/30">
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Table</p>
            <p className="font-bold text-sm">{reservation.table_name || "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Guest Name</p>
            <p className="font-bold text-sm capitalize">{reservation.buyer_name || "—"}</p>
          </div>
          {reservation.seats > 0 && (
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Capacity</p>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground" />
                <p className="font-bold text-sm">{reservation.seats} guests</p>
              </div>
            </div>
          )}
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Booking ID</p>
            <p className="font-bold text-sm font-mono">{bookingCode}</p>
          </div>
        </div>

        {/* Payment summary */}
        <div className="p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <p className="font-mono text-[10px] text-primary uppercase tracking-wider font-bold mb-2">Payment Summary</p>

          {tablePrice != null ? (
            <div className="flex justify-between text-sm gap-2">
              <span className="text-muted-foreground">Table Amount</span>
              <span className="font-mono font-bold">{fmt(tablePrice)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm gap-2">
              <span className="text-muted-foreground">Table Amount</span>
              <span className="font-mono text-muted-foreground text-xs">Not available</span>
            </div>
          )}

          {serviceFee != null && serviceFee > 0 && (
            <div className="flex justify-between text-sm gap-2">
              <span className="text-muted-foreground">Service Fee</span>
              <span className="font-mono font-bold">{fmt(serviceFee)}</span>
            </div>
          )}

          {processingFee != null && processingFee > 0 && (
            <div className="flex justify-between text-sm gap-2">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-mono font-bold">{fmt(processingFee)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold border-t border-primary/20 pt-2 mt-1 gap-2">
            <span className="text-sm">Total Paid</span>
            <span className="font-mono text-primary text-base">
              {totalPaid != null ? fmt(totalPaid) : "Not available"}
            </span>
          </div>
        </div>

        {/* Share button */}
        {reservation.status === "reserved" && (
          <TableShareCard reservation={reservation} event={event} bookingCode={bookingCode} />
        )}
      </div>
    </div>
  );
}