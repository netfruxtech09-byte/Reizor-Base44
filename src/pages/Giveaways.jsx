import { useState, useEffect } from "react";
import { Gift, ExternalLink, Clock, Users, Trophy, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { isPast } from "date-fns";
import { formatGiveawayEndDate } from "@/utils/giveawayUtils";
import GiveawayDetailModal from "@/components/giveaways/GiveawayDetailModal";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import { maybeTriggerPrizeGuide } from "@/lib/onboardingGuides";

export default function Giveaways() {
  const navigate = useNavigate();
  const [giveaways, setGiveaways] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedGiveaway, setSelectedGiveaway] = useState(null);
  const [myEntries, setMyEntries] = useState([]);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [eventMap, setEventMap] = useState({});

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const load = async () => {
    const [u, all] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Giveaway.filter({ status: "active" }, "-created_date", 100).catch(() => []),
    ]);
    setUser(u);
    setGiveaways(all);
    // Fetch linked events for event-linked giveaways to enable city/country filtering
    const linkedIds = [...new Set(
      all.filter(g => g.giveaway_type === "event_linked" && g.linked_event_id).map(g => g.linked_event_id)
    )];
    if (linkedIds.length) {
      const evts = await Promise.all(linkedIds.map(id => base44.entities.Event.get(id).catch(() => null)));
      const map = {};
      evts.forEach(e => { if (e && e.id) map[e.id] = e; });
      setEventMap(map);
    }
    if (u) {
      const entries = await base44.entities.GiveawayEntry.filter({ user_email: u.email }, "-created_date", 200).catch(() => []);
      setMyEntries(entries);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getEvent = (g) => g.giveaway_type === "event_linked" && g.linked_event_id ? eventMap[g.linked_event_id] : null;
  const getCountry = (g) => getEvent(g)?.country || "";
  const getCity = (g) => getEvent(g)?.city || "";

  const locatedGiveaways = giveaways.filter(g => getEvent(g));
  const countries = [...new Set(locatedGiveaways.map(g => getCountry(g)).filter(Boolean))].sort();
  const cities = [...new Set(
    (countryFilter ? locatedGiveaways.filter(g => getCountry(g) === countryFilter) : locatedGiveaways)
      .map(g => getCity(g)).filter(Boolean)
  )].sort();

  const filtered = giveaways.filter(g => {
    const matchType = typeFilter === "all" || g.giveaway_type === typeFilter;
    if (!matchType) return false;
    // Community giveaways have no location data — always pass location filtering (graceful)
    if (g.giveaway_type === "community") return true;
    const matchCountry = !countryFilter || getCountry(g) === countryFilter;
    const matchCity = !cityFilter || getCity(g) === cityFilter;
    return matchCountry && matchCity;
  });

  const getMyEntry = (giveawayId) => myEntries.find(e => e.giveaway_id === giveawayId);

  const PRIZE_LABELS = {
    free_ticket: "🎟️ Free Ticket",
    physical_item: "📦 Physical Prize",
    wallet_credit: "💳 Wallet Credit",
    custom: "🎁 Prize",
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (user && user.role !== "user") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Gift className="w-14 h-14 text-muted-foreground/30 mx-auto" />
        <p className="font-display font-bold text-xl">Fan Accounts Only</p>
        <p className="text-sm text-muted-foreground">Giveaways are available for fan accounts only. Switch to a fan account to enter.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 md:px-6">
      {/* Back Button */}
      <div className="mb-2 -mx-4 md:mx-0 px-4 md:px-0 pt-2 safe-top-header" data-safe-top>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight flex items-center gap-2">
          <Gift className="w-6 md:w-7 h-6 md:h-7 text-primary" /> GIVEAWAYS
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">Enter active giveaways from events and community creators</p>
      </div>

      {/* Filters — tabs + location dropdowns in one compact row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div className="flex gap-1 p-1 bg-card border border-border/50 rounded-lg shrink-0 self-start">
          {[
            { key: "all", label: "All" },
            { key: "event_linked", label: "Event" },
            { key: "community", label: "Community" },
          ].map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors ${typeFilter === t.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {typeFilter !== "community" && (
          <>
            <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:w-44">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Country</span>
              <select
                value={countryFilter}
                onChange={e => { setCountryFilter(e.target.value); setCityFilter(""); }}
                className="h-9 rounded-md border border-white/25 bg-transparent px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="" className="bg-card">All Countries</option>
                {countries.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:w-44">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">City</span>
              <select
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                className="h-9 rounded-md border border-white/25 bg-transparent px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="" className="bg-card">All Cities</option>
                {cities.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
      {typeFilter !== "community" && (
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground font-mono leading-relaxed">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
          <span>
            City &amp; Country filters apply only to <strong className="text-foreground">event-linked</strong> giveaways. Community giveaways always appear under <strong className="text-foreground">All</strong> together with event giveaways.
          </span>
        </div>
      )}
      {typeFilter === "community" && (
        <p className="text-xs text-muted-foreground font-mono">
          No location filter available for community giveaways.
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gift className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-display font-bold text-lg">No Active Giveaways</p>
          <p className="text-sm mt-1">Check back soon — new giveaways are added regularly!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(g => {
            const myEntry = getMyEntry(g.id);
            const isEnded = g.end_date && isPast(new Date(g.end_date));
            const ev = getEvent(g);
            const locStr = ev ? ([ev.city, ev.country].filter(Boolean).join(", ") || ev.venue_name || "") : "";
            return (
              <div key={g.id}
                onClick={() => setSelectedGiveaway(g)}
                className="group p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all cursor-pointer space-y-3">
                {g.cover_image && (
                  <img src={g.cover_image} alt={g.title} className="w-full h-36 object-cover rounded-lg" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold">{g.title}</h3>
                    {g.giveaway_type === "event_linked" && (
                      <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase">Event</span>
                    )}
                  </div>
                  {g.linked_event_title && <p className="text-xs text-muted-foreground font-mono">📅 {g.linked_event_title}</p>}
                  {g.prize_description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.prize_description}</p>}
                </div>

                {locStr ? (
                  <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground min-h-[1.4rem]">
                    <MapPin className="w-3 h-3 text-accent shrink-0" />
                    <span className="truncate">{locStr}</span>
                  </div>
                ) : (
                  <div className="min-h-[1.4rem]" aria-hidden="true" />
                )}

                <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-muted-foreground">
                  <span>{PRIZE_LABELS[g.prize_type] || "🎁 Prize"}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.total_entries || 0} entered</span>
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-400" />{g.num_winners || 1} winner{g.num_winners !== 1 ? "s" : ""}</span>
                </div>

                {g.end_date && (
                  <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {isEnded ? "Ended" : `Ends ${formatGiveawayEndDate(g.end_date)}`}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  {myEntry ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-mono text-green-400 font-bold capitalize">{myEntry.status.replace(/_/g, " ")}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">Not entered</span>
                  )}
                  <span className="text-xs font-mono text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedGiveaway && (
        <GiveawayDetailModal
          giveaway={selectedGiveaway}
          user={user}
          myEntry={getMyEntry(selectedGiveaway.id)}
          onClose={() => setSelectedGiveaway(null)}
          onEntered={() => { setSelectedGiveaway(null); load(); maybeTriggerPrizeGuide(user, setShowPrizeGuide); }}
        />
      )}

      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </div>
  );
}