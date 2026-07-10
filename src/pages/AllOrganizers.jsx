import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, MapPin, Search, ArrowLeft, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { compactNumber } from "@/utils/formatNumber";
import PageMeta from "@/components/seo/PageMeta";

export default function AllOrganizers() {
  const navigate = useNavigate();
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");

  useEffect(() => {
    (async () => {
      const [profiles, events, listOrgRes] = await Promise.all([
        base44.entities.OrganizerProfile.list(null, 500).catch(() => []),
        base44.entities.Event.list(null, 500).catch(() => []),
        base44.functions.invoke("listOrganizers", {}).catch(() => ({ data: { organizers: [] } })),
      ]);

      // Use backend function for organizer names (bypasses User RLS)
      const organizerLookup = {};
      (listOrgRes?.data?.organizers || []).forEach(o => {
        organizerLookup[String(o.organizer_id)] = o;
      });

      // Only use the backend organizer list as the authoritative source — it already
      // filters to users with role="organizer". Profiles and events from removed/downgraded
      // organizers must not appear as separate cards.
      const organizerIds = new Set(Object.keys(organizerLookup));

      const result = [];
      for (const oid of organizerIds) {
        const profile = profiles.find(p => String(p.organizer_id) === oid);
        const orgInfo = organizerLookup[oid];
        const orgEvents = events.filter(e => String(e.organizer_id) === oid && e.status === "published");
        if (orgEvents.length === 0 && !profile && !orgInfo) continue;

        const displayName = profile?.business_name || orgInfo?.business_name || "Incomplete Profile";
        const location = [profile?.city, profile?.state, profile?.country]
          .filter(Boolean).join(", ") || orgEvents[0]?.city || "";

        result.push({
          id: oid,
          name: displayName,
          image: profile?.profile_image || "",
          location,
          city: profile?.city || orgEvents[0]?.city || "",
          country: profile?.country || orgEvents[0]?.country || "",
          eventCount: orgEvents.length,
          bio: profile?.bio || "",
        });
      }

      result.sort((a, b) => b.eventCount - a.eventCount);
      setOrganizers(result);
      setLoading(false);
    })();
  }, []);

  // Dedupe country/city names ignoring case + extra whitespace, keep first-seen casing for display
  const dedupe = (values) => {
    const map = new Map();
    values.filter(Boolean).forEach(v => {
      const clean = v.trim().replace(/\s+/g, " ");
      const key = clean.toLowerCase();
      if (!map.has(key)) map.set(key, clean);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  };

  const countries = dedupe(organizers.map(o => o.country));
  const cities = dedupe(
    organizers
      .filter(o => !filterCountry || (o.country || "").trim().toLowerCase() === filterCountry.toLowerCase())
      .map(o => o.city)
  );

  const filtered = organizers.filter(o => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCountry && (o.country || "").trim().toLowerCase() !== filterCountry.toLowerCase()) return false;
    if (filterCity && (o.city || "").trim().toLowerCase() !== filterCity.toLowerCase()) return false;
    return true;
  });

  const hasActiveFilters = search || filterCountry || filterCity;
  const resetFilters = () => { setSearch(""); setFilterCountry(""); setFilterCity(""); };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <PageMeta
        title="All Organizers — REIZOR"
        description="Browse all event organizers on Reizor. Find music events, check organizer profiles, and discover your next night out."
        canonical="https://reizor.com/organizers"
      />
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-mono text-xs">Back</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ Organizers</span>
        </div>
        <h1 className="font-display font-black text-4xl tracking-tight">ALL ORGANIZERS</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Browse all event organizers on the platform — find your next night out.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-6">
            <div className="relative flex-1 min-w-[160px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search organizers…"
                className="pl-9 h-9 text-sm bg-secondary border-border/50 w-full"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterCountry}
                onChange={e => { setFilterCountry(e.target.value); setFilterCity(""); }}
                className="flex-1 sm:flex-none bg-secondary border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono h-9 min-w-0"
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
                disabled={cities.length === 0}
                className="flex-1 sm:flex-none bg-secondary border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono h-9 min-w-0 disabled:opacity-50"
              >
                <option value="">All Cities</option>
                {cities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors self-start sm:self-center"
              >
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <span className="font-mono text-xs text-muted-foreground sm:self-center sm:ml-auto">
              {filtered.length} of {organizers.length} organizer{organizers.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center rounded-xl bg-card border border-border/50">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-display font-bold text-base text-muted-foreground">No organizers found</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(org => (
                <Link
                  key={org.id}
                  to={`/organizers/${org.id}`}
                  className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/40 hover:bg-card/80 hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {org.image ? (
                        <img src={org.image} alt={org.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {org.name}
                      </h3>
                      {org.location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 truncate font-mono">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {org.location}
                        </p>
                      )}
                      {org.bio && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {org.bio}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {compactNumber(org.eventCount)} event{org.eventCount !== 1 ? "s" : ""}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}