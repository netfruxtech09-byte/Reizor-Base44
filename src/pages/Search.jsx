import { useState, useEffect, useMemo, useRef } from "react";
import { Search as SearchIcon, SlidersHorizontal, X, Calendar, DollarSign } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import EventCard from "../components/events/EventCard";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import PageMeta from "@/components/seo/PageMeta";
import PullToRefresh from "@/components/shared/PullToRefresh";
import PeopleSearchResults from "@/components/discovery/PeopleSearchResults";
import LocationSelector from "@/components/shared/LocationSelector";

const GENRES = [
  { value: "all", label: "All Genres" },
  { value: "techno", label: "Techno" },
  { value: "house", label: "House" },
  { value: "drum_and_bass", label: "D&B" },
  { value: "trance", label: "Trance" },
  { value: "hip_hop", label: "Hip Hop" },
  { value: "rnb", label: "R&B" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Electronic" },
  { value: "latin", label: "Latin" },
  { value: "reggaeton", label: "Reggaeton" },
  { value: "afrobeats", label: "Afrobeats" },
  { value: "jazz", label: "Jazz" },
  { value: "other", label: "Other" },
];

const PRICE_RANGES = [
  { label: "Any Price", value: "any" },
  { label: "Free", value: "free" },
  { label: "Under $25", value: "0-25" },
  { label: "$25–$75", value: "25-75" },
  { label: "$75–$150", value: "75-150" },
  { label: "$150+", value: "150-9999" },
];

export default function Search() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [artists, setArtists] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [whiteLabels, setWhiteLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [location, setLocation] = useState({ country: "", state: "", city: "" });
  const { country, state, city } = location;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [priceRange, setPriceRange] = useState("any");
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [peopleResults, setPeopleResults] = useState([]);
  const searchRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const urlGenre = urlParams.get("genre");

  useEffect(() => {
    if (urlGenre) setGenre(urlGenre);
  }, [urlGenre]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Event.filter({ status: "published" }, "-date", 200),
      base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, null, 500),
      base44.functions.invoke("listOrganizers", {}),
      base44.entities.WhiteLabel.list(null, 500).catch(() => []),
    ])
      .then(([evs, arts, orgsRes, wls]) => {
        const upcoming = filterUpcomingEvents(evs);
        setAllEvents(upcoming);
        setEvents(upcoming);
        // Extra safety: only show artists with a display_name
        setArtists((arts || []).filter(a => a.display_name));
        const orgList = orgsRes?.data?.organizers || [];
        setOrganizers(orgList);
        setWhiteLabels(wls || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build autocomplete suggestions from events, artists, organizers, white labels
  useEffect(() => {
    if (!search || search.length < 2) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    const seen = new Set();
    const hits = [];
    
    // Events
    for (const e of allEvents) {
      const candidates = [
        e.title && { label: e.title, type: "event", id: e.id },
        e.city && { label: e.city, type: "city" },
        e.venue_name && { label: e.venue_name, type: "venue" },
      ].filter(Boolean);
      for (const c of candidates) {
        if (c.label.toLowerCase().includes(q) && !seen.has(c.label)) {
          seen.add(c.label);
          hits.push(c);
        }
      }
    }
    
    // Artists
    for (const a of artists) {
      if (a.display_name?.toLowerCase().includes(q) && !seen.has(a.display_name)) {
        seen.add(a.display_name);
        hits.push({ label: a.display_name, type: "artist", id: a.id });
      }
    }
    
    // Organizers
    for (const o of organizers) {
      const name = o.business_name || o.full_name;
      if (name?.toLowerCase().includes(q) && !seen.has(name)) {
        seen.add(name);
        hits.push({ label: name, type: "organizer", id: o.organizer_id });
      }
    }
    
    // White Labels
    for (const w of whiteLabels) {
      if (w.brand_name?.toLowerCase().includes(q) && !seen.has(w.brand_name)) {
        seen.add(w.brand_name);
        hits.push({ label: w.brand_name, type: "white_label", id: w.id });
      }
    }
    
    setSuggestions(hits.slice(0, 8));
  }, [search, allEvents, artists, organizers, whiteLabels]);

  // People search — organizers, artists, and opted-in public fans matching the query.
  // Powers direct-to-profile routing (exact match) and the compact "People" list.
  useEffect(() => {
    if (!search || search.trim().length < 2) { setPeopleResults([]); return; }
    const q = search.trim();
    const t = setTimeout(() => {
      base44.functions.invoke("searchPeople", { query: q })
        .then(res => setPeopleResults(res?.data?.people || []))
        .catch(() => setPeopleResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredEvents = useMemo(() => {
    let evs = allEvents;
    if (genre && genre !== "all") evs = evs.filter(e => e.genre === genre);
    if (city.trim()) evs = evs.filter(e => e.city?.toLowerCase().includes(city.toLowerCase()));
    if (state.trim()) evs = evs.filter(e => e.venue_state?.toLowerCase().includes(state.toLowerCase()));
    if (country.trim()) evs = evs.filter(e => e.country?.toLowerCase().includes(country.toLowerCase()));
    if (dateFrom) evs = evs.filter(e => e.date && new Date(e.date) >= new Date(dateFrom));
    if (dateTo) evs = evs.filter(e => e.date && new Date(e.date) <= new Date(dateTo + "T23:59:59"));
    if (priceRange && priceRange !== "any") {
      if (priceRange === "free") evs = evs.filter(e => (e.min_price || 0) === 0);
      else {
        const [mn, mx] = priceRange.split("-").map(Number);
        evs = evs.filter(e => { const p = e.min_price || 0; return p >= mn && p <= mx; });
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      evs = evs.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q) ||
        e.artists?.some(a => a.toLowerCase().includes(q))
      );
    }
    return evs;
  }, [allEvents, genre, city, state, country, dateFrom, dateTo, priceRange, search]);

  const filteredArtists = useMemo(() => {
    let arts = artists;
    if (search.trim()) {
      const q = search.toLowerCase();
      arts = arts.filter(a => a.display_name?.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q));
    }
    if (city.trim() || state.trim() || country.trim()) {
      arts = arts.filter(a =>
        (!city.trim() || a.location?.toLowerCase().includes(city.toLowerCase())) &&
        (!state.trim() || a.location?.toLowerCase().includes(state.toLowerCase())) &&
        (!country.trim() || a.location?.toLowerCase().includes(country.toLowerCase()))
      );
    }
    return arts;
  }, [artists, search, city, state, country]);

  const filteredOrganizers = useMemo(() => {
    let orgs = organizers;
    if (search.trim()) {
      const q = search.toLowerCase();
      orgs = orgs.filter(o =>
        o.business_name?.toLowerCase().includes(q) ||
        o.full_name?.toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q)
      );
    }
    return orgs;
  }, [organizers, search]);

  const filteredWhiteLabels = useMemo(() => {
    let wls = whiteLabels;
    if (search.trim()) {
      const q = search.toLowerCase();
      wls = wls.filter(w => w.brand_name?.toLowerCase().includes(q) || w.name?.toLowerCase().includes(q));
    }
    return wls;
  }, [whiteLabels, search]);

  const handleSearch = () => {
    setShowSuggestions(false);
    // Exact single name match — go straight to that person's public profile.
    const exactMatches = peopleResults.filter(p => p.exact);
    if (exactMatches.length === 1) {
      navigate(exactMatches[0].href);
    }
  };

  const clearAll = () => {
    setGenre("all"); setLocation({ country: "", state: "", city: "" }); setSearch("");
    setDateFrom(""); setDateTo(""); setPriceRange("any");
  };

  // Active filter count — shown as a badge on the Filter button
  const activeFilterCount = [
    genre !== "all",
    !!city.trim(),
    !!state.trim(),
    !!country.trim(),
    !!dateFrom,
    !!dateTo,
    priceRange !== "any",
  ].filter(Boolean).length;

  const handleRefresh = async () => {
    setLoading(true);
    const [evs, arts, orgsRes, wls] = await Promise.all([
      base44.entities.Event.filter({ status: "published" }, "-date", 200),
      base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, null, 500),
      base44.functions.invoke("listOrganizers", {}),
      base44.entities.WhiteLabel.list(null, 500).catch(() => []),
    ]);
    const upcoming = filterUpcomingEvents(evs);
    setAllEvents(upcoming);
    setEvents(upcoming);
    setArtists((arts || []).filter(a => a.display_name));
    setOrganizers(orgsRes?.data?.organizers || []);
    setWhiteLabels(wls || []);
    setLoading(false);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <PageMeta
        title="Search Events & Artists — REIZOR"
        description="Search and discover music events, artists, and organizers on Reizor. Filter by genre, city, date, and price."
        canonical="https://reizor.com/search"
      />
      {/* Header */}
      <div className="mb-8">
        <BackButton />
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">
          ★ DISCOVER
        </span>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-1">
          FIND YOUR NIGHT
        </h1>
      </div>

      {/* Compact Search + Filter Bar — filters hidden by default so events are visible immediately */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1" ref={searchRef}>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="pl-10 bg-card border-border/50 h-11 font-display"
            />
            {search && (
              <button onClick={() => { setSearch(""); setSuggestions([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg bg-card border border-border shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} onMouseDown={() => { setSearch(s.label); setShowSuggestions(false); if (s.type === "city") setLocation(l => ({ ...l, city: s.label })); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-left">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      s.type === "event" ? "text-primary bg-primary/10" :
                      s.type === "city" ? "text-accent bg-accent/10" :
                      s.type === "artist" ? "text-chart-3 bg-chart-3/10" :
                      s.type === "organizer" ? "text-orange-400 bg-orange-400/10" :
                      s.type === "white_label" ? "text-purple-400 bg-purple-400/10" :
                      "text-muted-foreground bg-muted"}`}>{s.type === "white_label" ? "brand" : s.type}</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSearch} className="h-11 px-5 font-display font-bold glow-lime gap-1.5 shrink-0">
            <SearchIcon className="w-4 h-4" /> <span className="hidden sm:inline">Search</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="relative h-11 w-11 border-border/50 shrink-0 touch-manipulation"
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Bottom Sheet — opens on filter button tap; preserves selected filters */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-card border-b border-border/40 p-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-base">Filters {activeFilterCount > 0 && <span className="text-primary text-sm">({activeFilterCount})</span>}</h3>
              <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground touch-manipulation p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Location */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5">Location</p>
                <LocationSelector value={location} onChange={setLocation} required={false} />
              </div>
              {/* Genre */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5">Genre</p>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="w-full bg-secondary border-border/50 text-sm h-10">
                    <SelectValue placeholder="All Genres" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Date Range */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date Range
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 bg-secondary border-border/50 text-sm h-10" />
                  <span className="text-xs text-muted-foreground shrink-0 text-center">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 bg-secondary border-border/50 text-sm h-10" />
                </div>
              </div>
              {/* Price Range */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Price Range
                </p>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="w-full bg-secondary border-border/50 text-sm h-10">
                    <SelectValue placeholder="Any Price" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_RANGES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 bg-card border-t border-border/40 p-4 flex gap-2">
              <Button variant="outline" onClick={clearAll} className="flex-1 touch-manipulation">Clear All</Button>
              <Button onClick={() => setShowFilters(false)} className="flex-1 glow-lime touch-manipulation">Apply Filters</Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <PeopleSearchResults people={peopleResults} />

          <h2 className="font-display font-bold text-lg mb-4 text-primary">EVENTS</h2>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No events found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && (
        <div className="mt-8 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            {filteredEvents.length} RESULT{filteredEvents.length !== 1 ? "S" : ""} FOUND
          </p>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}