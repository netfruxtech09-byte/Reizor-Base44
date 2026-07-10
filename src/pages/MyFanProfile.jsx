import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DollarSign, Ticket, Heart, Star, Calendar, ArrowLeft, LogOut, Trophy, BarChart3, Gift, Users, Search, ExternalLink, UserMinus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import PullToRefresh from "@/components/shared/PullToRefresh";
import FanLoyaltyDashboard from "@/components/loyalty/FanLoyaltyDashboard";

export default function MyFanProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loyaltyAccount, setLoyaltyAccount] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);
  const [savedActivities, setSavedActivities] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "overview");
  const [activityTab, setActivityTab] = useState("all");
  const [followedOrganizers, setFollowedOrganizers] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [followingTab, setFollowingTab] = useState("all");
  const [followingSearch, setFollowingSearch] = useState("");

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);

      const [loyalty, tix, saved, subs, allEvents, savedActs, orgFollows, artistFollows] = await Promise.all([
        base44.entities.LoyaltyAccount.filter({ user_email: u.email }, null, 1).catch(() => []),
        base44.entities.Ticket.filter({ owner_email: u.email }, "-created_date", 100).catch(() => []),
        base44.entities.SavedEvent.filter({ user_email: u.email }, "-created_date", 50).catch(() => []),
        base44.entities.FanSubscription.filter({ fan_email: u.email }, "-started_at", 1).catch(() => []),
        base44.entities.Event.filter({}, null, 500).catch(() => []),
        base44.entities.SavedActivity.filter({ user_email: u.email }, "-created_date", 100).catch(() => []),
        base44.entities.OrganizerFollow.filter({ follower_email: u.email }, "-created_date", 200).catch(() => []),
        base44.entities.ArtistFollow.filter({ follower_email: u.email }, "-created_date", 200).catch(() => []),
      ]);

      setLoyaltyAccount(loyalty[0] || null);
      setTickets(tix);
      setSavedEvents(saved);
      setSavedActivities(savedActs);
      setSubscription(subs[0] || null);
      setFollowedOrganizers(orgFollows);
      setFollowedArtists(artistFollows);

      // Map events by ID for quick lookup
      const eventMap = {};
      allEvents.forEach((e) => (eventMap[e.id] = e));
      setEvents(eventMap);

      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleUnsaveEvent = async (savedEventId) => {
    await base44.entities.SavedEvent.delete(savedEventId);
    setSavedEvents((prev) => prev.filter((s) => s.id !== savedEventId));
    toast.success("Event removed from saved");
  };

  const handleCancelMembership = async () => {
    if (!subscription) return;
    if (!confirm("Cancel membership? You'll lose access to tier benefits.")) return;
    await base44.entities.FanSubscription.update(subscription.id, { status: "cancelled", cancelled_at: new Date().toISOString() });
    setSubscription(null);
    toast.success("Membership cancelled");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!user) return <div className="text-center py-20 text-muted-foreground">Not authenticated</div>;

  const TAB_NAV = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Event History" },
    { key: "following", label: `Following (${followedOrganizers.length + followedArtists.length})` },
    { key: "saved", label: "Saved Events" },
    { key: "activities", label: "Saved Activities" },
    { key: "loyalty", label: "Loyalty & Rewards" },
    { key: "membership", label: "Membership" },
  ];

  const handleRefresh = async () => {
    const u = await base44.auth.me();
    if (!u) return;
    const [loyalty, tix, saved, subs, allEvents, savedActs, orgFollows, artistFollows] = await Promise.all([
      base44.entities.LoyaltyAccount.filter({ user_email: u.email }, null, 1).catch(() => []),
      base44.entities.Ticket.filter({ owner_email: u.email }, "-created_date", 100).catch(() => []),
      base44.entities.SavedEvent.filter({ user_email: u.email }, "-created_date", 50).catch(() => []),
      base44.entities.FanSubscription.filter({ fan_email: u.email }, "-started_at", 1).catch(() => []),
      base44.entities.Event.filter({}, null, 500).catch(() => []),
      base44.entities.SavedActivity.filter({ user_email: u.email }, "-created_date", 100).catch(() => []),
      base44.entities.OrganizerFollow.filter({ follower_email: u.email }, "-created_date", 200).catch(() => []),
      base44.entities.ArtistFollow.filter({ follower_email: u.email }, "-created_date", 200).catch(() => []),
    ]);
    setLoyaltyAccount(loyalty[0] || null);
    setTickets(tix);
    setSavedEvents(saved);
    setSavedActivities(savedActs);
    setSubscription(subs[0] || null);
    setFollowedOrganizers(orgFollows);
    setFollowedArtists(artistFollows);
    const eventMap = {};
    allEvents.forEach((e) => (eventMap[e.id] = e));
    setEvents(eventMap);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight">{user.full_name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </Button>
        </div>

        {/* Tab Nav */}
        <div className="border-t border-border/30 px-4 sm:px-6 flex gap-4 overflow-x-auto">
          {TAB_NAV.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-6">
            {loyaltyAccount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-card border border-accent/20 bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono text-accent font-bold uppercase tracking-widest">Cashback Balance</p>
                      <p className="font-display font-black text-3xl text-accent mt-2">${loyaltyAccount.cashback_balance.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total spent: ${loyaltyAccount.total_spent.toFixed(2)}</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-accent/40" />
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Paid Membership</p>
                  {subscription ? (
                    <>
                      <p className="font-display font-bold text-lg">{subscription.tier_name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          subscription.status === "active" ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-muted"
                        }`}>
                          {subscription.status}
                        </span>
                        {subscription.status === "active" && subscription.next_billing_date && (
                          <span className="text-xs text-muted-foreground">Renews {format(new Date(subscription.next_billing_date), "MMM dd")}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No active membership</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <Ticket className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs font-mono text-muted-foreground">Tickets</p>
                <p className="font-display font-black text-2xl mt-1">{tickets.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <Heart className="w-5 h-5 text-destructive mb-2" />
                <p className="text-xs font-mono text-muted-foreground">Saved</p>
                <p className="font-display font-black text-2xl mt-1">{savedEvents.length + savedActivities.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <Calendar className="w-5 h-5 text-accent mb-2" />
                <p className="text-xs font-mono text-muted-foreground">Attended</p>
                <p className="font-display font-black text-2xl mt-1">{loyaltyAccount?.attended_count || 0}</p>
              </div>
              <Link to="/messages" className="p-4 rounded-xl bg-card border border-primary/30 hover:border-primary/60 transition-colors group">
                <MessageSquare className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs font-mono text-muted-foreground">Messages</p>
                <p className="font-display font-black text-lg mt-1 group-hover:text-primary transition-colors">Inbox →</p>
              </Link>
            </div>

            {subscription && (
               <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                 <p className="text-sm text-muted-foreground mb-3">You have an active paid membership with exclusive benefits.</p>
                 <Button variant="outline" onClick={handleCancelMembership} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                   Cancel Membership
                 </Button>
               </div>
             )}
          </div>
        )}

        {/* Event History Tab */}
        {tab === "history" && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-lg">Your Event History</h2>
            {tickets.length === 0 ? (
              <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground">
                No tickets yet. <a href="/search" className="text-primary hover:underline">Browse events</a>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => {
                  const evt = events[ticket.event_id];
                  return (
                    <div key={ticket.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold">{evt?.title || ticket.event_title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{ticket.ticket_type_name}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {evt?.date && <span className="text-xs font-mono text-muted-foreground">{format(new Date(evt.date), "MMM dd, yyyy")}</span>}
                          {evt?.venue_name && <span className="text-xs font-mono text-muted-foreground">• {evt.venue_name}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">${ticket.price_paid.toFixed(2)}</p>
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded mt-1 inline-block ${
                          ticket.status === "active" ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-muted"
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Following Tab */}
        {tab === "following" && (() => {
          const allFollowing = [
            ...followedOrganizers.map(f => ({ ...f, _type: "organizer", _name: f.organizer_name || "Organizer", _href: `/organizers/${f.organizer_id}`, _recordId: f.id })),
            ...followedArtists.map(f => ({ ...f, _type: "artist", _name: f.artist_name || "Artist", _href: `/artists/${f.artist_id}`, _recordId: f.id })),
          ];
          const tabFiltered = followingTab === "all" ? allFollowing : allFollowing.filter(f => f._type === followingTab);
          const searchFiltered = !followingSearch.trim() ? tabFiltered : tabFiltered.filter(f => f._name.toLowerCase().includes(followingSearch.toLowerCase()));

          const handleUnfollow = async (item) => {
            if (!confirm(`Unfollow ${item._name}?`)) return;
            if (item._type === "organizer") {
              await base44.entities.OrganizerFollow.delete(item._recordId).catch(() => {});
              setFollowedOrganizers(prev => prev.filter(f => f.id !== item._recordId));
            } else {
              await base44.entities.ArtistFollow.delete(item._recordId).catch(() => {});
              setFollowedArtists(prev => prev.filter(f => f.id !== item._recordId));
            }
            toast.success(`Unfollowed ${item._name}`);
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Following <span className="text-sm font-mono text-muted-foreground">({allFollowing.length})</span>
                </h2>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-2 flex-wrap">
                {[{ key: "all", label: `All (${allFollowing.length})` }, { key: "organizer", label: `Organizers (${followedOrganizers.length})` }, { key: "artist", label: `Artists (${followedArtists.length})` }].map(t => (
                  <button key={t.key} onClick={() => setFollowingTab(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold whitespace-nowrap transition-all ${followingTab === t.key ? "bg-primary text-white" : "bg-card border border-border/50 text-muted-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={followingSearch}
                  onChange={e => setFollowingSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border/50 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {searchFiltered.length === 0 ? (
                <div className="p-10 rounded-xl bg-card border border-border/50 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">
                    {allFollowing.length === 0 ? "You're not following anyone yet." : "No results found."}
                  </p>
                  {allFollowing.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Follow organizers and artists to see them here.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchFiltered.map(item => (
                    <div key={item._recordId} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${item._type === "organizer" ? "bg-yellow-400/10 text-yellow-400" : "bg-primary/10 text-primary"}`}>
                          {item._name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{item._name}</p>
                          <p className="text-xs font-mono text-muted-foreground capitalize">{item._type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={item._href}>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                            <ExternalLink className="w-3 h-3" /> View
                          </Button>
                        </Link>
                        <Button onClick={() => handleUnfollow(item)} variant="outline" size="sm"
                          className="gap-1.5 text-xs h-8 text-destructive border-destructive/40 hover:bg-destructive/10">
                          <UserMinus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Saved Events Tab */}
        {tab === "saved" && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-lg">Saved Events</h2>
            {savedEvents.length === 0 ? (
              <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground">
                No saved events yet. <a href="/search" className="text-primary hover:underline">Find events to save</a>
              </div>
            ) : (
              <div className="space-y-3">
                {savedEvents.map((saved) => {
                  const evt = events[saved.event_id];
                  return (
                    <div key={saved.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold">{evt?.title || saved.event_title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          Saved {format(new Date(saved.created_date), "MMM dd, yyyy")}
                        </p>
                        {evt?.date && <p className="text-sm text-muted-foreground mt-2">{format(new Date(evt.date), "MMMM dd, yyyy")}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => evt && navigate(`/events/${evt.id}`)} variant="outline" size="sm">
                          View
                        </Button>
                        <Button onClick={() => handleUnsaveEvent(saved.id)} variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                          Unsave
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Saved Activities Tab */}
        {tab === "activities" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-display font-bold text-lg">Saved Activities</h2>
              <div className="flex gap-2 overflow-x-auto">
                {["all", "raffle", "giveaway", "poll"].map(t => (
                  <button key={t} onClick={() => setActivityTab(t)}
                    className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-full whitespace-nowrap transition-all ${
                      activityTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground"
                    }`}>
                    {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1) + "s"}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const filtered = activityTab === "all"
                ? savedActivities
                : savedActivities.filter(a => a.activity_type === activityTab);

              if (filtered.length === 0) return (
                <div className="p-8 rounded-xl bg-card border border-border/50 text-center text-muted-foreground space-y-2">
                  <p className="text-sm">No saved {activityTab === "all" ? "activities" : activityTab + "s"} yet.</p>
                  <p className="text-xs">Use the 🔖 Save button on any Raffle, Giveaway, or Poll to save it here.</p>
                </div>
              );

              return (
                <div className="space-y-3">
                  {filtered.map(act => {
                    const typeConfig = {
                      raffle: { icon: <Trophy className="w-4 h-4 text-yellow-400" />, label: "Raffle", href: `/raffle/${act.activity_id}`, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
                      giveaway: { icon: <Gift className="w-4 h-4 text-green-400" />, label: "Giveaway", href: `/events/${act.event_id}`, color: "text-green-400 bg-green-400/10 border-green-400/30" },
                      poll: { icon: <BarChart3 className="w-4 h-4 text-accent" />, label: "Poll", href: `/poll/${act.activity_id}`, color: "text-accent bg-accent/10 border-accent/30" },
                    }[act.activity_type] || { icon: null, label: act.activity_type, href: "#", color: "text-muted-foreground bg-muted border-border" };

                    const handleUnsave = async () => {
                      await base44.entities.SavedActivity.delete(act.id).catch(() => {});
                      setSavedActivities(prev => prev.filter(a => a.id !== act.id));
                      toast.success("Removed from saved activities");
                    };

                    return (
                      <div key={act.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${typeConfig.color}`}>
                              {typeConfig.icon} {typeConfig.label}
                            </span>
                            {act.event_title && (
                              <span className="text-[10px] font-mono text-muted-foreground truncate">Event: {act.event_title}</span>
                            )}
                          </div>
                          <p className="font-bold text-sm truncate">{act.activity_title}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            Saved {act.created_date ? format(new Date(act.created_date), "MMM d, yyyy") : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={typeConfig.href}>
                            <Button variant="outline" size="sm" className="text-xs h-8">View</Button>
                          </Link>
                          <Button onClick={handleUnsave} variant="outline" size="sm"
                            className="text-xs h-8 text-destructive border-destructive/40 hover:bg-destructive/10">
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Loyalty & Rewards Tab — points-based, separate from paid Membership. "Member" always refers only to paid membership. */}
        {tab === "loyalty" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" /> Loyalty & Rewards
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Earn points from Organizers, Artists, and the Reizor Community by following them and participating in eligible activities. This is open to every fan and is separate from paid Membership.
              </p>
            </div>
            <FanLoyaltyDashboard userEmail={user?.email} />
          </div>
        )}

        {/* Membership Tab */}
        {tab === "membership" && (
          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg">Paid Membership</h2>
            {subscription && subscription.status === "active" ? (
              <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
                <div className="flex items-center gap-3">
                  <Star className="w-6 h-6 text-yellow-400" />
                  <div>
                     <p className="font-display font-bold text-lg">{subscription.tier_name}</p>
                     <p className="text-sm text-muted-foreground">Active membership</p>
                   </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>💰 Earn cashback on all purchases</p>
                  <p>🎁 Exclusive member perks</p>
                  <p>⏰ Early event booking access</p>
                </div>
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs font-mono text-accent font-bold">Next billing</p>
                  <p className="text-sm mt-1">
                    {subscription.next_billing_date ? format(new Date(subscription.next_billing_date), "MMMM dd, yyyy") : "Soon"}
                  </p>
                </div>
                <Button onClick={handleCancelMembership} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 w-full">
                  Cancel Membership
                </Button>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-card border border-border/50 text-center space-y-4">
                <p className="text-muted-foreground">You don't have a paid membership.</p>
                <Button asChild className="glow-lime font-display font-bold w-full">
                  <a href="/profile">Explore Membership Plans</a>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}