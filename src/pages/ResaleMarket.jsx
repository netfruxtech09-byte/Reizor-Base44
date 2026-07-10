import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tag, Calendar, Ticket, ShoppingCart, Filter, X, ArrowLeft } from "lucide-react";
import { getTicketPlatformFee } from "@/utils/ticketFeeCalculator";
import { format } from "date-fns";
import { toast } from "sonner";
import PageMeta from "@/components/seo/PageMeta";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function ResaleMarket() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [filterCity, setFilterCity] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Load current user alongside listings so Buy button can be conditionally hidden
    const [active, me] = await Promise.all([
      base44.entities.TicketListing.filter({ status: "active" }, "-created_date", 100),
      base44.auth.me().catch(() => null),
    ]);
    setCurrentUser(me);
    setListings(active);
    const eventIds = [...new Set(active.map((l) => l.event_id))];
    const evMap = {};
    await Promise.all(eventIds.map(async (eid) => {
      const evs = await base44.entities.Event.filter({ id: eid }, null, 1);
      if (evs[0]) evMap[eid] = evs[0];
    }));
    setEvents(evMap);
    setLoading(false);
  }

  async function buyTicket(listing) {
    if (buying) return;
    setBuying(listing.id);

    // Require authentication
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      setBuying(null);
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }

    const user = await base44.auth.me();
    if (user.email === listing.seller_email) {
      toast.error("You can't buy your own listing");
      setBuying(null);
      return;
    }

    // Redirect to Stripe checkout for resale
    try {
      const res = await base44.functions.invoke('stripeResaleCheckout', {
        ticketListingId: listing.id,
      });
      if (res.data?.sessionUrl) {
        window.location.href = res.data.sessionUrl;
        return;
      }
      throw new Error('No payment session returned');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Purchase failed';
      toast.error(msg);
      setBuying(null);
      return;
    }
  }

  // Derive unique filter options from loaded events
  const cities = useMemo(() => [...new Set(Object.values(events).map(e => e.city).filter(Boolean))].sort(), [events]);
  const countries = useMemo(() => [...new Set(Object.values(events).map(e => e.country).filter(Boolean))].sort(), [events]);
  const genres = useMemo(() => [...new Set(Object.values(events).map(e => e.genre).filter(Boolean))].sort(), [events]);

  const filteredListings = useMemo(() => listings.filter(listing => {
    const ev = events[listing.event_id];
    if (filterCity && ev?.city !== filterCity) return false;
    if (filterCountry && ev?.country !== filterCountry) return false;
    if (filterGenre && ev?.genre !== filterGenre) return false;
    return true;
  }), [listings, events, filterCity, filterCountry, filterGenre]);

  if (detectIsIOS()) return null;

  const hasFilters = filterCity || filterCountry || filterGenre;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-4xl mx-auto">
      <PageMeta
        title="Ticket Resale Market — REIZOR"
        description="Buy and sell event tickets safely on the Reizor Resale Market. Find discounted tickets or resell tickets you can't use."
        canonical="https://reizor.com/resale"
      />
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-mono text-xs">Back</span>
      </button>
      <div className="mb-6">
        <h1 className="font-display font-black text-4xl tracking-tight">RESALE MARKET.</h1>
        <p className="text-sm text-muted-foreground mt-2">Buy tickets from other fans.</p>
      </div>

      {/* Filters */}
      {!loading && listings.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center mb-6 p-4 rounded-xl bg-card border border-border/50">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
            className="bg-background border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono min-w-[130px]"
          >
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterCountry}
            onChange={e => setFilterCountry(e.target.value)}
            className="bg-background border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono min-w-[140px]"
          >
            <option value="">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterGenre}
            onChange={e => setFilterGenre(e.target.value)}
            className="bg-background border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono min-w-[130px]"
          >
            <option value="">All Genres</option>
            {genres.map(g => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setFilterCity(""); setFilterCountry(""); setFilterGenre(""); }}
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border/50 rounded-md px-3 py-1.5 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-20">
          <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-display font-bold text-xl text-muted-foreground">{hasFilters ? "No listings match your filters" : "No listings right now"}</p>
          <p className="text-sm text-muted-foreground mt-2">{hasFilters ? "Try adjusting the filters above" : "Check back later or browse upcoming events"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((listing) => {
            const event = events[listing.event_id];
            const savings = listing.original_price - listing.resale_price;
            const isOwnListing = currentUser?.email === listing.seller_email;
            return (
              <div key={listing.id} className={`bg-card border rounded-xl p-5 transition-all space-y-4 ${isOwnListing ? "border-accent/30" : "border-border/50 hover:border-primary/30"}`}>
                <div>
                  <h3 className="font-display font-black text-base tracking-tight leading-tight">{listing.event_title}</h3>
                  <p className="font-mono text-xs text-primary mt-1">{listing.ticket_type_name}</p>
                </div>

                {event && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span className="font-mono">{format(new Date(event.date), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ticket className="w-3 h-3" />
                      <span>{event.venue_name}, {event.city}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-mono font-black text-2xl text-primary">${(listing.resale_price + getTicketPlatformFee(listing.resale_price)).toFixed(2)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">incl. ${getTicketPlatformFee(listing.resale_price).toFixed(2)} platform fee</p>
                      {savings > 0 && (
                        <p className="font-mono text-[10px] text-green-400">Save ${savings.toFixed(2)} vs original</p>
                      )}
                    </div>
                    {isOwnListing ? (
                      <span className="text-[10px] font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-1 rounded">
                        Your listing
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="glow-lime font-display font-bold gap-1"
                        onClick={() => buyTicket(listing)}
                        disabled={buying === listing.id}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {buying === listing.id ? "..." : "Buy"}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="font-mono text-[10px] text-muted-foreground/50">{isOwnListing ? "Your resale listing" : `Sold by ${listing.seller_name}`}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}