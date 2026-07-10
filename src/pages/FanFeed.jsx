import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Calendar, Ticket, Users, ArrowRight, Sparkles, Images, FileText, Play, UserPlus, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import PullToRefresh from "@/components/shared/PullToRefresh";

async function loadFeedData(u) {
  const [artistFollows, orgFollows] = await Promise.all([
    base44.entities.ArtistFollow.filter({ follower_email: u.email }, null, 200).catch(() => []),
    base44.entities.OrganizerFollow.filter({ follower_email: u.email }, null, 200).catch(() => []),
  ]);

  const followedOrgIds = orgFollows.map(f => f.organizer_id);
  const followedArtistNames = artistFollows.map(f => f.artist_name);
  const followedArtistIds = artistFollows.map(f => f.artist_id);

  // Load everything in parallel; filter at query level where possible
  const [orgMedia, artistPosts, tickets, rsvps] = await Promise.all([
    followedOrgIds.length > 0
      ? base44.entities.OrganizerMediaPost.filter(
          { status: "active", approval_status: "approved" },
          "-created_date",
          200
        ).catch(() => [])
      : Promise.resolve([]),
    followedArtistIds.length > 0
      ? base44.entities.ArtistPost.filter(
          { status: "published" },
          "-created_date",
          100
        ).catch(() => [])
      : Promise.resolve([]),
    base44.entities.Ticket.filter({ owner_email: u.email, status: "active" }, "-created_date", 50).catch(() => []),
    base44.entities.EventRsvp.filter({ user_email: u.email }, "-created_date", 50).catch(() => []),
  ]);

  // Filter organizer media only for followed orgs
  const followedOrgPosts = orgMedia.filter(p => followedOrgIds.includes(p.organizer_id));

  // Filter artist posts only for followed artists
  const followedArtistPosts = artistPosts.filter(p => followedArtistIds.includes(p.artist_id) || followedArtistNames.includes(p.artist_name));

  // Merge into a unified feed, sorted newest first
  const unifiedFeed = [
    ...followedOrgPosts.map(p => ({
      ...p,
      _feedType: "org_post",
      _date: p.created_date,
      _href: `/organizers/${p.organizer_id}?section=posts`,
      _owner: p.organizer_name || "Organizer",
      _ownerHref: `/organizers/${p.organizer_id}`,
    })),
    ...followedArtistPosts.map(p => ({
      ...p,
      _feedType: "artist_post",
      _date: p.created_date,
      _href: `/artists/${p.artist_id}`,
      _owner: p.artist_name || "Artist",
      _ownerHref: `/artists/${p.artist_id}`,
    })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  // Upcoming events from followed orgs/artists
  const upcomingEvents = orgFollows.length > 0 || artistFollows.length > 0
    ? await base44.entities.Event.filter({ status: "published" }, "-date", 100).catch(() => [])
    : [];

  const filteredEvents = upcomingEvents.filter(e => {
    const isFromFollowedOrg = followedOrgIds.includes(e.organizer_id);
    const isFromFollowedArtist = e.artist_details?.some(ad => followedArtistNames.includes(ad.name));
    return (isFromFollowedOrg || isFromFollowedArtist) && new Date(e.date) > new Date();
  });

  return { unifiedFeed, tickets, rsvps, orgFollows, artistFollows, filteredEvents };
}

export default function FanFeed() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unifiedFeed, setUnifiedFeed] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [orgFollows, setOrgFollows] = useState([]);
  const [artistFollows, setArtistFollows] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);
      const data = await loadFeedData(u);
      setUnifiedFeed(data.unifiedFeed);
      setTickets(data.tickets);
      setRsvps(data.rsvps);
      setOrgFollows(data.orgFollows);
      setArtistFollows(data.artistFollows);
      setFilteredEvents(data.filteredEvents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    const u = await base44.auth.me();
    if (!u) return;
    const data = await loadFeedData(u);
    setUnifiedFeed(data.unifiedFeed);
    setTickets(data.tickets);
    setRsvps(data.rsvps);
    setOrgFollows(data.orgFollows);
    setArtistFollows(data.artistFollows);
    setFilteredEvents(data.filteredEvents);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="text-center py-20 text-muted-foreground">
      <p>Please log in to view your personalized feed.</p>
    </div>
  );

  const noFollows = orgFollows.length === 0 && artistFollows.length === 0;
  const isEmpty = unifiedFeed.length === 0 && tickets.length === 0 && filteredEvents.length === 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-5 px-4 md:px-6">
      {/* Back Button */}
      <div className="mb-2 -mx-4 px-4 md:mx-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
      </div>

      {/* Header */}
      <div className="pt-2">
        <h1 className="font-display font-black text-lg md:text-2xl tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 md:w-6 h-5 md:h-6 text-primary" /> Your Feed
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">
          {noFollows ? "Follow organizers and artists to personalize your feed" : "Latest from accounts you follow, newest first"}
        </p>
      </div>

      {/* Empty state for no follows */}
      {noFollows && (
        <div className="text-center py-10 md:py-12 bg-card rounded-lg border border-border/50 space-y-3 -mx-4 md:mx-0 px-4 md:px-6">
          <UserPlus className="w-8 md:w-10 h-8 md:h-10 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="font-display font-bold text-sm md:text-base">You're not following anyone yet</p>
            <p className="text-xs text-muted-foreground mt-1">Follow organizers and artists to see their posts and events.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button asChild size="sm" className="glow-lime font-display font-bold text-xs">
              <Link to="/organizers">Discover Organizers</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="font-display font-bold text-xs">
              <Link to="/artists">Discover Artists</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Unified Post/Media Feed — newest first */}
      {unifiedFeed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-sm md:text-base">Latest Posts & Media</h2>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{unifiedFeed.length} item{unifiedFeed.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {unifiedFeed.slice(0, 20).map(item => (
              <Link
                key={item.id}
                to={item._href}
                className="flex gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/40 transition-all group"
              >
                <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0 bg-muted">
                  {item.thumbnail_url || item.media_url || item.cover_image ? (
                    <img src={item.thumbnail_url || item.media_url || item.cover_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  {(item.media_type === "video" || item._feedType === "artist_post") && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-2.5 h-2.5 text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[7px] font-mono font-bold uppercase px-0.5 py-0.5 rounded ${
                      item._feedType === "org_post" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
                    }`}>
                      {item._feedType === "org_post" ? "Organizer" : "Artist"}
                    </span>
                  </div>
                  <p className="font-mono text-[8px] text-muted-foreground uppercase tracking-wide font-bold truncate">{item._owner}</p>
                  <p className="text-xs font-medium mt-0.5 line-clamp-2">
                    {item.caption || item.content || (item.media_type === "video" ? "New video" : "New post")}
                  </p>
                  {item._date && (
                    <p className="text-[8px] font-mono text-muted-foreground mt-0.5">
                      Posted {formatDistanceToNow(new Date(item._date), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {unifiedFeed.length > 20 && (
            <p className="text-[10px] text-center text-muted-foreground font-mono py-1">Showing 20 of {unifiedFeed.length} items</p>
          )}
        </div>
      )}

      {/* Upcoming Events from Followed Accounts */}
      {filteredEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="font-display font-bold text-sm md:text-base">Upcoming Events</h2>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{filteredEvents.length} upcoming</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredEvents.slice(0, 6).map(event => (
              <Link key={event.id} to={`/events/${event.id}`}
                className="p-2.5 md:p-3 rounded-lg bg-card border border-border/50 hover:border-accent/40 transition-all group">
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <p className="font-display font-bold text-xs md:text-sm group-hover:text-accent transition-colors line-clamp-1">{event.title}</p>
                  <span className="text-[7px] font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded shrink-0">
                    {event.genre?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{event.venue_name} · {format(new Date(event.date), "MMM dd")}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Your Tickets */}
      {tickets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-green-400" />
            <h2 className="font-display font-bold text-sm md:text-base">Your Tickets</h2>
          </div>
          <div className="space-y-1.5">
            {tickets.slice(0, 5).map(ticket => (
              <Link key={ticket.id} to="/my-tickets"
                className="p-2.5 rounded-lg bg-card border border-border/50 hover:border-green-400/40 transition-all flex items-center justify-between group">
                <div className="min-w-0">
                  <p className="font-display font-bold text-xs md:text-sm truncate">{ticket.ticket_type_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{ticket.event_title}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
              </Link>
            ))}
          </div>
          {tickets.length > 5 && (
            <Button asChild size="sm" variant="outline" className="w-full font-display font-bold text-xs">
              <Link to="/my-tickets">View All {tickets.length}</Link>
            </Button>
          )}
        </div>
      )}

      {/* Empty: following someone but no content yet */}
      {!noFollows && isEmpty && (
        <div className="text-center py-10 bg-card rounded-lg border border-border/50">
          <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="font-display font-bold text-sm mb-1">No posts yet</p>
          <p className="text-xs text-muted-foreground">Accounts you follow haven't posted anything yet. Check back soon!</p>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}