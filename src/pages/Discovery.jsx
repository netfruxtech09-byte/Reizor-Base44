import { useState, useEffect, useMemo } from "react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { Link } from "react-router-dom";
import { Flame, Calendar, Video, Music, Star, ChevronRight, Compass } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import DiscoveryFilters, { haversineKm } from "../components/discovery/DiscoveryFilters";
import { base44 } from "@/api/base44Client";
import PageMeta from "@/components/seo/PageMeta";
import { format } from "date-fns";
import Video360Player from "../components/media/Video360Player";

export default function Discovery() {
  const [user, setUser] = useState(null);
  const [trendingArtists, setTrendingArtists] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [videos360, setVideos360] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [filters, setFilters] = useState({ genres: [], dateRange: null, price: null, distanceKm: null, userLocation: null });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);

      const preferredGenres = u?.preferred_genres || [];

      // Fetch all data in parallel
      const [artists, events, posts, follows, tickets] = await Promise.all([
        base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, "-follower_count", 50),
        base44.entities.Event.filter({ status: "published" }, "date", 100),
        base44.entities.ArtistPost.filter({ approval_status: "approved" }, "-created_date", 200),
        u ? base44.entities.ArtistFollow.filter({ follower_email: u.email }, null, 100) : [],
        u ? base44.entities.Ticket.filter({ owner_email: u.email }, null, 100) : [],
      ]);

      const followedArtistIds = new Set(follows.map(f => f.artist_id));
      const attendedEventIds = new Set(tickets.map(t => t.event_id));

      // --- Trending Artists ---
      // Boost artists in followed genres, followed artists, sort by follower count
      const scoredArtists = artists.map(a => {
        let score = a.follower_count || 0;
        if (followedArtistIds.has(a.id)) score += 5000;
        if (preferredGenres.length > 0) {
          const artistGenre = a.genre?.toLowerCase().replace(/ /g, "_") || "";
          if (preferredGenres.some(g => artistGenre.includes(g) || g.includes(artistGenre))) score += 3000;
        }
        return { ...a, score };
      });
      scoredArtists.sort((a, b) => b.score - a.score);
      setTrendingArtists(scoredArtists.filter(a => a.display_name).slice(0, 12));

      // --- Upcoming Events ---
      const future = filterUpcomingEvents(events);
      const scoredEvents = future.map(e => {
        let score = e.tickets_sold || 0;
        if (attendedEventIds.has(e.id)) score += 10000;
        if (preferredGenres.length > 0) {
          const genre = e.genre?.toLowerCase().replace(/ /g, "_") || "";
          if (preferredGenres.some(g => genre.includes(g) || g.includes(genre))) score += 5000;
        }
        return { ...e, score };
      });
      scoredEvents.sort((a, b) => b.score - a.score);
      setAllEvents(scoredEvents);
      setUpcomingEvents(scoredEvents.slice(0, 12));

      // --- 360° Videos ---
      // Only show 360 videos from valid active/approved artists
      const validArtistIds = new Set(artists.map(a => a.id));
      const vids = posts.filter(p =>
        p.artist_id &&
        validArtistIds.has(p.artist_id) &&
        p.media_urls?.some((_, i) => p.media_types?.[i] === "video360")
      );
      setVideos360(vids.slice(0, 9));

      setLoading(false);
    };
    load();
  }, []);

  const filteredEvents = useMemo(() => {
    let events = allEvents;
    const { genres, dateRange, price, distanceKm, userLocation, city, state, country } = filters;
    const hasFilters = genres.length > 0 || dateRange || price || distanceKm || city || state || country;
    if (!hasFilters) return null; // null = use default scored list

    if (city) events = events.filter(e => e.city?.toLowerCase().includes(city.toLowerCase()));
    if (state) events = events.filter(e => e.venue_state?.toLowerCase().includes(state.toLowerCase()));
    if (country) events = events.filter(e => e.country?.toLowerCase().includes(country.toLowerCase()));

    if (genres.length > 0) {
      events = events.filter(e => genres.includes(e.genre));
    }
    if (dateRange) {
      events = events.filter(e => {
        const d = new Date(e.date);
        return d >= dateRange.start && d <= dateRange.end;
      });
    }
    if (price) {
      events = events.filter(e => {
        const p = e.min_price || 0;
        if (price.key === "free") return p === 0;
        if (price.max === Infinity) return p >= price.min;
        return p >= price.min && p <= price.max;
      });
    }
    if (distanceKm && userLocation) {
      events = events.filter(e => {
        if (!e.latitude || !e.longitude) return true; // keep if no coords
        const d = haversineKm(userLocation.lat, userLocation.lon, e.latitude, e.longitude);
        return d <= distanceKm;
      });
    }
    return events;
  }, [allEvents, filters]);

  const displayedEvents = filteredEvents !== null ? filteredEvents : upcomingEvents;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const hasInterests = user?.preferred_genres?.length > 0;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-14">
      <PageMeta
        title="Discover Events — REIZOR"
        description="Discover trending artists, upcoming music events, and 360° videos personalized for you on Reizor."
        canonical="https://reizor.com/discover"
      />
      <BackButton />
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">
          {user ? `FOR YOU, ${(user.full_name || "").split(" ")[0].toUpperCase() || "EXPLORER"}` : "DISCOVER"}
        </h1>
        {!hasInterests && user && (
          <p className="text-sm text-muted-foreground mt-2">
            <Link to="/profile" className="text-primary underline">Set your genre preferences</Link> to get personalized recommendations.
          </p>
        )}
        {!user && (
          <p className="text-sm text-muted-foreground mt-2">
            <button onClick={() => base44.auth.redirectToLogin()} className="text-primary underline">Sign in</button> to personalize your feed.
          </p>
        )}
      </div>

      {/* Trending Artists */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            <h2 className="font-display font-black text-2xl tracking-tight">TRENDING ARTISTS</h2>
          </div>
          <Link to="/artists" className="flex items-center gap-1 text-xs font-mono text-primary hover:underline">
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {trendingArtists.length === 0 ? (
          <p className="text-muted-foreground text-sm">No artists yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {trendingArtists.map(artist => (
              <Link key={artist.id} to={`/artists/${artist.id}`}
                className="group flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all">
                {artist.profile_image ? (
                  <img src={artist.profile_image} alt={artist.display_name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-border group-hover:border-primary/50 transition-all" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center">
                    <Music className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0 w-full">
                  <p className="font-display font-bold text-sm truncate">{artist.display_name}</p>
                  {artist.genre && (
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest truncate">
                      {artist.genre.replace(/_/g, " ")}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-primary mt-0.5">
                    {(artist.follower_count || 0).toLocaleString()} followers
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            <h2 className="font-display font-black text-2xl tracking-tight">UPCOMING EVENTS</h2>
          </div>
          <Link to="/search" className="flex items-center gap-1 text-xs font-mono text-accent hover:underline">
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5">
          <DiscoveryFilters onFiltersChange={setFilters} />
        </div>

        {displayedEvents.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-card border border-border/50">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No events match your filters.</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting or clearing your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedEvents.map(event => {
              const cover = event.cover_image || event.gallery_images?.[0] || null;
              const coverIsVid = cover && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(cover);
              return (
              <Link key={event.id} to={`/events/${event.id}`}
                className="group flex gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-accent/40 transition-all overflow-hidden">
                {cover ? (
                  coverIsVid ? (
                    <video src={cover} autoPlay muted loop playsInline
                      className="w-20 h-20 rounded-lg object-cover shrink-0" />
                  ) : (
                    <img src={cover} alt={event.title}
                      className="w-20 h-20 rounded-lg object-cover shrink-0" />
                  )
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-7 h-7 text-accent" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-sm leading-tight truncate">{event.title}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                    {event.venue_name}{event.city ? `, ${event.city}` : ""}
                  </p>
                  <p className="font-mono text-[10px] text-accent mt-1 font-bold">
                    {event.date ? format(new Date(event.date), "EEE, MMM dd · yyyy") : "Date TBA"}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {event.genre && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {event.genre.replace(/_/g, " ")}
                      </span>
                    )}
                    {event.min_price != null && (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {event.min_price === 0 ? "Free" : `From $${event.min_price}`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              );
              })}
              </div>
              )}
              </section>

              {/* 360° Videos */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Video className="w-5 h-5 text-chart-3" />
          <h2 className="font-display font-black text-2xl tracking-tight">POPULAR 360° VIDEOS</h2>
        </div>
        {videos360.length === 0 ? (
          <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
            <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No 360° videos posted yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Artists can upload equirectangular MP4s from their Studio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos360.map(post => {
              const vidIdx = post.media_types?.findIndex(t => t === "video360");
              if (vidIdx === -1 || vidIdx === undefined) return null;
              const vidUrl = post.media_urls[vidIdx];
              const isExpanded = expandedVideo === post.id;
              return (
                <div key={post.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="p-3 flex items-center gap-2 border-b border-border/30">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs truncate">{post.artist_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {format(new Date(post.created_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <span className="font-mono text-[9px] text-chart-3 border border-chart-3/30 px-1.5 py-0.5 rounded-full">360°</span>
                  </div>
                  {post.caption && (
                    <p className="px-3 pt-2 text-xs text-muted-foreground truncate">{post.caption}</p>
                  )}
                  {isExpanded ? (
                    <div className="p-2">
                      <Video360Player src={vidUrl} />
                      <button onClick={() => setExpandedVideo(null)}
                        className="w-full mt-2 text-xs font-mono text-muted-foreground hover:text-foreground">
                        Collapse ↑
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setExpandedVideo(post.id)}
                      className="w-full relative group">
                      <div className="h-40 bg-gradient-to-br from-primary/10 to-accent/10 flex flex-col items-center justify-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-black/30 border-2 border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-mono text-xs text-white/70">Click to play 360°</span>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Personalization CTA */}
      {user && !hasInterests && (
        <section className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center">
          <Star className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display font-black text-xl mb-2">Personalize Your Discovery</h3>
          <p className="text-sm text-muted-foreground mb-4">Tell us your favorite genres and we'll tailor trending artists and events just for you.</p>
          <Link to="/profile"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm glow-lime">
            Set Your Preferences <ChevronRight className="w-4 h-4" />
          </Link>
        </section>
      )}
    </div>
  );
}