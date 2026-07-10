import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Navigation, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import EventCard from "../events/EventCard";

const LOCATION_KEY = "home_city_filter";

function normalizeCity(city) {
  return city?.trim().toLowerCase();
}

export default function FeaturedEvents() {
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState(() => localStorage.getItem(LOCATION_KEY) || "");
  const [detecting, setDetecting] = useState(false);
  const [editingCity, setEditingCity] = useState(false);
  const [cityInput, setCityInput] = useState("");

  // Fetch all published events once
  useEffect(() => {
    base44.entities.Event.filter({ status: "published" }, "-created_date", 50)
      .then(data => {
        const upcoming = filterUpcomingEvents(data || []);
        setAllEvents(upcoming.filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-detect city from profile if no city saved
  useEffect(() => {
    if (city) return;
    base44.auth.me().then(u => {
      if (u?.city) {
        setCity(u.city);
        localStorage.setItem(LOCATION_KEY, u.city);
      }
    }).catch(() => {});
  }, []);

  // Filter events by city
  useEffect(() => {
    const safe = allEvents.filter(e => e && e.id);
    if (!city) {
      setEvents(safe.slice(0, 6));
      return;
    }
    const norm = normalizeCity(city);
    const local = safe.filter(e => normalizeCity(e.city)?.includes(norm) || norm.includes(normalizeCity(e.city) || "__"));
    setEvents(local.length > 0 ? local.slice(0, 6) : safe.slice(0, 6));
  }, [city, allEvents]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data = await res.json();
        const detected = data.address?.city || data.address?.town || data.address?.village || "";
        if (detected) {
          setCity(detected);
          localStorage.setItem(LOCATION_KEY, detected);
        }
        setDetecting(false);
      },
      () => setDetecting(false)
    );
  };

  const clearCity = () => {
    setCity("");
    localStorage.removeItem(LOCATION_KEY);
  };

  const submitCity = () => {
    if (cityInput.trim()) {
      setCity(cityInput.trim());
      localStorage.setItem(LOCATION_KEY, cityInput.trim());
    }
    setEditingCity(false);
    setCityInput("");
  };

  if (loading) {
    return (
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className="aspect-[3/4] bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (allEvents.length === 0) return null;

  const isFiltered = city && events.length > 0 && events[0]?.city;
  const noLocalEvents = city && events.length > 0 && !normalizeCity(events[0]?.city)?.includes(normalizeCity(city));

  return (
    <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ FEATURED</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">
            {city ? `EVENTS NEAR YOU` : `HOT RIGHT NOW`}
          </h2>
          {noLocalEvents && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">No local events found — showing all events</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* City pill */}
          {city && !editingCity && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-sm">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-primary font-bold">{city}</span>
              <button onClick={clearCity} className="ml-1 text-primary/60 hover:text-primary transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Edit city input */}
          {editingCity ? (
            <form onSubmit={e => { e.preventDefault(); submitCity(); }} className="flex items-center gap-1.5">
              <input
                autoFocus
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                placeholder="Enter city..."
                className="h-8 px-3 rounded-full bg-secondary border border-border/50 text-sm font-mono w-36 focus:outline-none focus:border-primary/50"
              />
              <button type="submit" className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">Go</button>
              <button type="button" onClick={() => setEditingCity(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <button
              onClick={() => { setEditingCity(true); setCityInput(city); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              <MapPin className="w-3 h-3" /> {city ? "Change" : "Set Location"}
            </button>
          )}

          {/* Auto-detect */}
          {!editingCity && (
            <button
              onClick={detectLocation}
              disabled={detecting}
              title="Detect my location"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-xs font-mono text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
            >
              {detecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
              {detecting ? "Detecting..." : "Auto-detect"}
            </button>
          )}

          <Link to="/search">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {events.filter(Boolean).map((event, i) => (
          <EventCard key={event.id} event={event} featured={i === 0} />
        ))}
      </div>
    </section>
  );
}