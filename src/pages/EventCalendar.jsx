import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, MapPin, Music, Heart, Calendar, Users } from "lucide-react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import PageMeta from "@/components/seo/PageMeta";

export default function EventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [user, setUser] = useState(null);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [genres, setGenres] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedArtistsFilter, setSelectedArtistsFilter] = useState([]);
  const [viewMode, setViewMode] = useState("month");
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me().catch(() => null);
      setUser(currentUser);

      const allEvents = await base44.entities.Event.filter(
        { status: "published" },
        "-date",
        500
      );
      setEvents(filterUpcomingEvents(allEvents));

      // Extract unique genres and locations
      const genreSet = new Set(allEvents.map(e => e.genre).filter(Boolean));
      const locationSet = new Set(allEvents.map(e => e.city).filter(Boolean));
      setGenres(Array.from(genreSet).sort());
      setLocations(Array.from(locationSet).sort());

      if (currentUser) {
        const [follows, rsvpRecords] = await Promise.all([
          base44.entities.ArtistFollow.filter(
            { follower_email: currentUser.email },
            null,
            500
          ),
          base44.entities.EventRsvp.filter(
            { user_email: currentUser.email },
            null,
            500
          ),
        ]);
        setFollowedArtists(follows.map(f => f.artist_name));
        setRsvps(rsvpRecords);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const filteredEvents = events.filter(event => {
    if (!event.date) return false;
    const eventDate = new Date(event.date);
    
    // Genre filter
    if (selectedGenres.length > 0 && !selectedGenres.includes(event.genre)) return false;
    
    // Location filter
    if (selectedLocations.length > 0 && !selectedLocations.includes(event.city)) return false;
    
    // Artist filter - show if any followed artist is in the lineup
    if (selectedArtistsFilter.length > 0) {
      const eventArtists = event.artists || [];
      const hasFollowedArtist = selectedArtistsFilter.some(a => eventArtists.includes(a));
      if (!hasFollowedArtist) return false;
    }
    
    return true;
  });

  const handleRsvp = async (event) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    const alreadyRsvped = rsvps.find(r => r.event_id === event.id);
    
    if (alreadyRsvped) {
      await base44.entities.EventRsvp.delete(alreadyRsvped.id);
      setRsvps(prev => prev.filter(r => r.id !== alreadyRsvped.id));
      toast.success("RSVP cancelled");
    } else {
      const newRsvp = await base44.entities.EventRsvp.create({
        event_id: event.id,
        event_title: event.title,
        event_date: event.date,
        venue_name: event.venue_name,
        city: event.city,
        user_email: user.email,
        user_name: user.full_name,
        rsvp_date: new Date().toISOString(),
        status: "going",
      });
      setRsvps(prev => [...prev, newRsvp]);
      toast.success("RSVP confirmed!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date) => {
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.date);
      return isSameDay(eventDate, date);
    });
  };

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDayIndex = monthStart.getDay();
  const emptyDays = Array(firstDayIndex).fill(null);
  const calendarGrid = [...emptyDays, ...calendarDays];

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6">
      <PageMeta
        title="Event Calendar — REIZOR"
        description="Browse upcoming music events by date on the Reizor event calendar. Filter by genre, location, and your followed artists. RSVP in one click."
        canonical="https://reizor.com/calendar"
      />
      <div>
        <h1 className="font-display font-black text-4xl tracking-tight">EVENT CALENDAR</h1>
        <p className="text-sm text-muted-foreground mt-1">Discover and RSVP to upcoming events</p>
      </div>

      {/* Filters */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Genre Filter */}
        <div className="space-y-2">
          <label className="font-display font-bold text-sm uppercase tracking-wider">Genre</label>
          <div className="flex flex-wrap gap-2">
            {genres.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenres(prev =>
                  prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
                )}
                className={`px-2.5 py-1.5 rounded-full text-xs font-mono font-bold transition-all ${
                  selectedGenres.includes(g)
                    ? "bg-primary text-primary-foreground border border-primary"
                    : "bg-card border border-border/50 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {g.replace(/_/g, " ").substring(0, 10)}
                {selectedGenres.includes(g) && <X className="w-3 h-3 ml-1 inline" />}
              </button>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div className="space-y-2">
          <label className="font-display font-bold text-sm uppercase tracking-wider">Location</label>
          <div className="flex flex-wrap gap-2">
            {locations.slice(0, 5).map(l => (
              <button
                key={l}
                onClick={() => setSelectedLocations(prev =>
                  prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
                )}
                className={`px-2.5 py-1.5 rounded-full text-xs font-mono font-bold transition-all ${
                  selectedLocations.includes(l)
                    ? "bg-accent text-accent-foreground border border-accent"
                    : "bg-card border border-border/50 text-muted-foreground hover:border-accent/40"
                }`}
              >
                {l.substring(0, 12)}
                {selectedLocations.includes(l) && <X className="w-3 h-3 ml-1 inline" />}
              </button>
            ))}
          </div>
        </div>

        {/* Artist Filter */}
        {followedArtists.length > 0 && (
          <div className="space-y-2">
            <label className="font-display font-bold text-sm uppercase tracking-wider">Following</label>
            <div className="flex flex-wrap gap-2">
              {followedArtists.slice(0, 5).map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedArtistsFilter(prev =>
                    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                  )}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-mono font-bold transition-all ${
                    selectedArtistsFilter.includes(a)
                      ? "bg-yellow-400 text-black border border-yellow-400"
                      : "bg-card border border-border/50 text-muted-foreground hover:border-yellow-400/40"
                  }`}
                >
                  {a.substring(0, 10)}
                  {selectedArtistsFilter.includes(a) && <X className="w-3 h-3 ml-1 inline" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="space-y-2">
          <label className="font-display font-bold text-sm uppercase tracking-wider">View</label>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("month")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50 text-muted-foreground hover:border-primary/40"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50 text-muted-foreground hover:border-primary/40"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Month/Year Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-card rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-display font-bold text-2xl tracking-tight">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-card rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar */}
      {viewMode === "month" ? (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-0 border-b border-border/50">
            {dayHeaders.map(day => (
              <div
                key={day}
                className="p-3 text-center font-mono text-xs font-bold text-muted-foreground uppercase border-r border-border/30 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 bg-background">
            {calendarGrid.map((day, idx) => {
              const dayEvents = day ? getEventsForDate(day) : [];
              const isCurrentMonth = day && isSameMonth(day, currentDate);

              return (
                <div
                  key={idx}
                  className={`min-h-24 border-r border-b border-border/30 last:border-r-0 p-2 ${
                    !isCurrentMonth ? "bg-muted/20" : "bg-background"
                  }`}
                >
                  {day && (
                    <>
                      <p className={`text-xs font-mono font-bold mb-1 ${
                        !isCurrentMonth ? "text-muted-foreground/50" : "text-muted-foreground"
                      }`}>
                        {format(day, "d")}
                      </p>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(event => (
                          <button
                            key={event.id}
                            onClick={() => setExpandedEvent(event)}
                            className="w-full text-left text-[10px] px-1.5 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary font-mono font-bold truncate hover:bg-primary/30 transition-colors"
                          >
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-[10px] text-muted-foreground font-mono px-1">
                            +{dayEvents.length - 2} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No events match your filters</p>
            </div>
          ) : (
            filteredEvents.map(event => {
              const isRsvped = rsvps.some(r => r.event_id === event.id);
              return (
                <div
                  key={event.id}
                  className="p-4 rounded-lg bg-card border border-border/50 hover:border-primary/40 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-display font-bold text-lg">{event.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground font-mono">
                        {event.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.date), "MMM dd, yyyy")}
                          </span>
                        )}
                        {event.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.venue_name}, {event.city}
                          </span>
                        )}
                        {event.genre && (
                          <span className="flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            {event.genre.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {event.artist_details?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {event.artist_details.slice(0, 3).map((a, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                              {a.name}
                            </span>
                          ))}
                          {event.artist_details.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{event.artist_details.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleRsvp(event)}
                      size="sm"
                      variant={isRsvped ? "default" : "outline"}
                      className={`shrink-0 gap-1.5 font-display font-bold ${
                        isRsvped ? "glow-lime" : ""
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isRsvped ? "fill-current" : ""}`} />
                      {isRsvped ? "Going" : "RSVP"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {expandedEvent && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-black text-2xl">{expandedEvent.title}</h2>
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded mt-2 inline-block">
                  {expandedEvent.genre?.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => setExpandedEvent(null)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expandedEvent.cover_image && (
              <img
                src={expandedEvent.cover_image}
                alt={expandedEvent.title}
                className="w-full rounded-lg object-cover aspect-video"
              />
            )}

            <div className="space-y-2 text-sm">
              {expandedEvent.date && (
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {format(new Date(expandedEvent.date), "EEEE, MMMM dd, yyyy")}
                </p>
              )}
              {expandedEvent.doors_open && (
                <p className="text-muted-foreground">Doors: {expandedEvent.doors_open}</p>
              )}
              {expandedEvent.venue_name && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent" />
                  {expandedEvent.venue_name}, {expandedEvent.city}
                </p>
              )}
              {expandedEvent.min_price && (
                <p className="flex items-center gap-2 text-green-400 font-bold">
                  From ${expandedEvent.min_price.toFixed(2)}
                </p>
              )}
            </div>

            {expandedEvent.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{expandedEvent.description}</p>
            )}

            {expandedEvent.artist_details?.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold text-sm">Line-up</p>
                <div className="flex flex-wrap gap-2">
                  {expandedEvent.artist_details.map((a, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground font-mono">
                      {a.name}
                      {a.performance_time && ` @ ${a.performance_time}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-border/50">
              <Button
                onClick={() => {
                  handleRsvp(expandedEvent);
                  setExpandedEvent(null);
                }}
                className="flex-1 glow-lime font-display font-bold gap-1.5"
              >
                <Heart className="w-4 h-4" />
                {rsvps.some(r => r.event_id === expandedEvent.id) ? "Cancel RSVP" : "RSVP Now"}
              </Button>
              <Button variant="outline" onClick={() => setExpandedEvent(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}