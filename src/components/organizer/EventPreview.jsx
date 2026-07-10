import { Calendar, MapPin, Clock, Users, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatPrice } from "@/utils/currency";

const isVideo = (url) => url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function EventPreview({ event, artistDetails, ticketTiers, tableTiers, currency = "USD", onEdit, onPublish, publishing }) {
  return (
    <div className="max-w-3xl space-y-6 pb-28 sm:pb-6">
      {/* Desktop action bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-accent tracking-[0.3em] uppercase">👁 Preview</span>
          <h2 className="font-display font-black text-2xl tracking-tight mt-1">How your post will look</h2>
          <p className="text-sm text-muted-foreground mt-1">Review everything before making it live</p>
        </div>
        <div className="hidden sm:flex gap-3">
          <button onClick={onEdit} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/50 transition-colors">
            ✏ Edit
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-mono font-bold glow-lime hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "🚀 Make Post Live"}
          </button>
        </div>
        {/* Mobile: show Edit only — Publish is in sticky bar */}
        <div className="flex sm:hidden gap-3">
          <button onClick={onEdit} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/50 transition-colors">
            ✏ Edit
          </button>
        </div>
      </div>

      {/* Mobile sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3 safe-area-inset-bottom">
        <button
          onClick={onPublish}
          disabled={publishing}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-base font-display font-black glow-lime hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {publishing ? "Publishing..." : "🚀 Make Post Live"}
        </button>
      </div>

      {/* Cover */}
      {event.cover_image ? (
        <div className="rounded-xl overflow-hidden aspect-[21/9]">
          {isVideo(event.cover_image) ? (
            <video
              src={event.cover_image}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
          )}
        </div>
      ) : (
        <div className="rounded-xl aspect-[21/9] bg-card border border-border/50 flex items-center justify-center">
          <p className="text-muted-foreground font-mono text-sm">No cover image</p>
        </div>
      )}

      {/* Title & genre */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">
            {event.genre?.replace(/_/g, " ")}
          </span>
          {event.age_restriction && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded">
              {event.age_restriction}
            </span>
          )}
        </div>
        <h1 className="font-display font-black text-4xl tracking-tighter">{event.title || "Event Title"}</h1>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <Calendar className="w-4 h-4 text-primary mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Date</p>
          <p className="font-display font-bold text-sm mt-0.5">
            {event.date ? format(new Date(event.date), "MMM dd, yyyy") : "TBA"}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <Clock className="w-4 h-4 text-accent mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Doors Open</p>
          <p className="font-display font-bold text-sm mt-0.5">{event.doors_open || "TBA"}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <MapPin className="w-4 h-4 text-primary mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Venue</p>
          <p className="font-display font-bold text-sm mt-0.5">{event.venue_name || "TBA"}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <Users className="w-4 h-4 text-accent mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Capacity</p>
          <p className="font-display font-bold text-sm mt-0.5">
            {event.total_capacity ? `${Number(event.total_capacity).toLocaleString()} ppl` : "TBA"}
          </p>
        </div>
      </div>

      {/* Artist lineup */}
      {artistDetails.filter(a => a.name.trim()).length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg mb-3">LINE-UP</h3>
          <div className="space-y-2">
            {artistDetails.filter(a => a.name.trim()).map((artist, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-3">
                  {artist.performance_time && (
                    <span className="font-mono text-xs text-primary font-bold min-w-[56px]">{artist.performance_time}</span>
                  )}
                  <span className="font-display font-bold">{artist.name}</span>
                </div>
                {artist.social_link && (
                  <a href={artist.social_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-mono text-accent hover:underline">
                    <ExternalLink className="w-3 h-3" /> Profile
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div>
          <h3 className="font-display font-bold text-lg mb-2">ABOUT</h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      {/* Tickets preview */}
      {ticketTiers.filter(t => t.name && t.price).length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg mb-3">TICKETS</h3>
          <div className="space-y-2">
            {ticketTiers.filter(t => t.name && t.price).map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50">
                <div>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">{t.tier?.replace(/_/g, " ")}</span>
                  <p className="font-display font-bold text-sm">{t.name}</p>
                </div>
                <span className="font-mono font-bold text-primary">{formatPrice(Number(t.price), currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables preview */}
      {tableTiers && tableTiers.filter(t => t.name && t.price).length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg mb-3">TABLE PACKAGES</h3>
          <div className="space-y-3">
            {tableTiers.filter(t => t.name && t.price).map((t, i) => (
              <div key={i} className="p-4 rounded-lg bg-card border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-display font-bold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.guests_per_table} guests</p>
                  </div>
                  <span className="font-mono font-bold text-primary text-lg">{formatPrice(Number(t.price), currency)}</span>
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}