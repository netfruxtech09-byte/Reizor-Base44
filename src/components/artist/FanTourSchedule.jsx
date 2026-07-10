import { useState, useEffect } from "react";
import { MapPin, Clock, Calendar, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import TourShareButton from "./TourShareButton";
import TourShowMedia from "./TourShowMedia";
import TourShowTicketCTA from "./TourShowTicketCTA";
import TicketLinkButton from "@/components/shared/TicketLinkButton";
import { Link } from "react-router-dom";

export default function FanTourSchedule({ artistId }) {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    base44.entities.ArtistTourSchedule.filter({ artist_id: artistId }, "date", 100)
      .then(data => { setShows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [artistId]);

  if (loading) return null;

  const now = new Date();
  const upcoming = shows.filter(s => new Date(s.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = shows.filter(s => new Date(s.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (shows.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-lg">TOUR SCHEDULE</h2>

      {upcoming.length === 0 && past.length > 0 && (
        <p className="text-sm text-muted-foreground font-mono">No upcoming shows. See past dates below.</p>
      )}

      {upcoming.map(show => <FanShowCard key={show.id} show={show} artistId={artistId} />)}

      {past.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowPast(v => !v)}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {showPast ? "▲ Hide" : "▼ Show"} past tour dates ({past.length})
          </button>
          {showPast && past.map(show => <FanShowCard key={show.id} show={show} artistId={artistId} past />)}
        </div>
      )}
    </div>
  );
}

function FanShowCard({ show, artistId, past }) {
  const address = [show.venue_name, show.full_address || [show.city, show.state, show.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

  return (
    <div className={`rounded-xl bg-card border overflow-hidden transition-colors ${past ? "border-border/30 opacity-60" : "border-border/50 hover:border-primary/30"}`}>
      <TourShowMedia show={show} rounded={false} />
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="font-display font-bold text-base leading-tight">{show.venue_name}</p>
            <div className="flex items-start gap-1 text-xs text-muted-foreground font-mono">
              <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="break-words">{address}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-mono text-primary font-bold">
                <Calendar className="w-3 h-3" />
                {show.date ? format(new Date(show.date), "EEE, MMM dd yyyy") : "—"}
              </span>
              {show.set_time && (
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <Clock className="w-3 h-3" /> {show.set_time}
                </span>
              )}
            </div>
            {show.notes && <p className="text-xs text-muted-foreground">{show.notes}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <TourShowTicketCTA show={show} />
          {show.ticket_link && (
            <TicketLinkButton
              href={show.ticket_link}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-colors"
            >
              🎟 Tickets
            </TicketLinkButton>
          )}
          {show.social_link && (
            <a href={show.social_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-mono font-bold hover:bg-accent/20 transition-colors">
              Info <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Link
            to={`/artists/${artistId}/tour/${show.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-mono font-bold hover:text-foreground hover:bg-muted transition-colors"
          >
            Details
          </Link>
          <TourShareButton show={show} artistId={artistId} />
        </div>
      </div>
    </div>
  );
}