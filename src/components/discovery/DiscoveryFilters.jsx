import { useState, useEffect } from "react";
import { MapPin, SlidersHorizontal, X, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LocationSelector from "@/components/shared/LocationSelector";

const GENRES = [
  "techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb",
  "pop", "rock", "jazz", "electronic", "latin", "reggaeton", "afrobeats", "other",
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { haversineKm };

export default function DiscoveryFilters({ onFiltersChange }) {
  const [open, setOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationType, setLocationType] = useState(null); // "my_location", "place"
  const [place, setPlace] = useState({ country: "", state: "", city: "" });
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const activeCount = [
    selectedGenre !== "",
    dateFrom !== "" || dateTo !== "",
    locationType !== null,
  ].filter(Boolean).length;

  const requestGeo = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationType("my_location");
        setGeoLoading(false);
      },
      (err) => {
        setGeoError("Location access denied. Use City or State filters instead.");
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const clearAll = () => {
    setSelectedGenre("");
    setDateFrom("");
    setDateTo("");
    setLocationType(null);
    setPlace({ country: "", state: "", city: "" });
    setUserLocation(null);
    setGeoError(null);
  };

  // Notify parent whenever filters change
  useEffect(() => {
    let dateRange = null;
    if (dateFrom) {
      dateRange = {
        start: new Date(dateFrom),
        end: dateTo ? new Date(dateTo + "T23:59:59") : new Date("2099-01-01"),
      };
    }

    onFiltersChange({
      genres: selectedGenre ? [selectedGenre] : [],
      dateRange,
      distanceKm: null,
      userLocation: locationType === "my_location" ? userLocation : null,
      city: locationType === "place" ? place.city : null,
      state: locationType === "place" ? place.state : null,
      country: locationType === "place" ? place.country : null,
    });
  }, [selectedGenre, dateFrom, dateTo, locationType, place, userLocation]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-mono font-bold transition-all ${
            open || activeCount > 0
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="bg-primary-foreground text-primary text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Active filter chips */}
        {selectedGenre && (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono text-primary">
            {selectedGenre.replace(/_/g, " ")}
            <button onClick={() => setSelectedGenre("")}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {(dateFrom || dateTo) && (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs font-mono text-accent">
            {dateFrom && !dateTo && `From ${dateFrom}`}
            {!dateFrom && dateTo && `Until ${dateTo}`}
            {dateFrom && dateTo && `${dateFrom} → ${dateTo}`}
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {locationType === "my_location" && (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-chart-5/10 border border-chart-5/30 text-xs font-mono text-chart-5">
            <MapPin className="w-3 h-3" /> My Location
            <button onClick={() => setLocationType(null)}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {locationType === "place" && (place.city || place.state || place.country) && (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-chart-5/10 border border-chart-5/30 text-xs font-mono text-chart-5">
            {place.city || place.state || place.country}
            <button onClick={() => { setLocationType(null); setPlace({ country: "", state: "", city: "" }); }}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-full text-xs font-mono text-muted-foreground border border-border/50 hover:text-foreground hover:border-border transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="p-5 rounded-2xl bg-card border border-border/50 space-y-5">
          {/* Genre Dropdown */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Genre
            </label>
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Genres</SelectItem>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Date Range
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-mono text-muted-foreground mb-1">From</p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-1.5 text-sm font-mono text-foreground"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-mono text-muted-foreground mb-1">To</p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-1.5 text-sm font-mono text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
              Location
            </label>

            {/* Location type selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={requestGeo}
                disabled={geoLoading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                  locationType === "my_location"
                    ? "bg-chart-5 text-white border-chart-5"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-chart-5/40"
                }`}
              >
                {geoLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Detecting...
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" /> My Location
                  </>
                )}
              </button>

              <button
                onClick={() => setLocationType("place")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                  locationType === "place"
                    ? "bg-chart-5 text-white border-chart-5"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-chart-5/40"
                }`}
              >
                Choose Location
              </button>
            </div>

            {/* Geo error message */}
            {geoError && (
              <p className="text-xs text-destructive mb-3">{geoError}</p>
            )}

            {/* User location confirmation */}
            {userLocation && locationType === "my_location" && (
              <p className="text-xs text-chart-5 font-mono mb-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location: ({userLocation.lat.toFixed(2)}°,{" "}
                {userLocation.lon.toFixed(2)}°)
              </p>
            )}

            {/* Cascading Country → State → City picker */}
            {locationType === "place" && (
              <LocationSelector value={place} onChange={setPlace} required={false} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}