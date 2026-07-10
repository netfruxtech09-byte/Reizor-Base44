import { useState, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES } from "@/lib/countries";
import { getStatesForCountry, getCitiesForState } from "@/utils/locationService";

// Render rows in pages so very large lists (e.g. US/India cities) stay fast to
// paint — more load automatically as the user scrolls near the bottom, or via
// the "Load more" button. Search always runs across the full options array.
const PAGE_SIZE = 200;

function ComboField({ label, value, onSelect, options, placeholder, disabled, loading, emptyText, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;

  // Reset pagination whenever the search term or the full option set changes
  // (covers country/state changes, which swap the `options` array).
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query, options]);

  const loadMore = () => setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length));

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore();
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground font-mono">{label}</Label>
      <Popover open={open} onOpenChange={(o) => { if (disabled) return; setOpen(o); if (!o) { setQuery(""); setVisibleCount(PAGE_SIZE); } }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`mt-1 w-full h-9 flex items-center justify-between gap-2 rounded-md border bg-secondary px-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-destructive ring-1 ring-destructive/40" : "border-white/25"}`}
          >
            <span className={value ? "text-foreground truncate" : "text-muted-foreground truncate"}>
              {loading ? "Loading..." : (value || placeholder)}
            </span>
            {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-w-[92vw] overflow-hidden rounded-lg border-white/25"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false} className="rounded-lg bg-secondary">
            <CommandInput
              placeholder={`Search ${label.replace(" *", "").toLowerCase()}...`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-56" onScroll={handleScroll}>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {visible.map(opt => (
                  <CommandItem key={opt} value={opt} onSelect={() => { onSelect(opt); setOpen(false); setQuery(""); }}>
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {hasMore && (
                <div className="px-2 pb-2 pt-1 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground font-mono px-1 pb-1.5">
                    Showing {visible.length} of {filtered.length} results
                  </p>
                  <button
                    type="button"
                    onClick={loadMore}
                    className="w-full text-xs font-mono font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 rounded-md py-2 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <p className="px-3 py-2 text-[10px] text-muted-foreground font-mono border-t border-border/30">
                  All {filtered.length} results loaded
                </p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Reusable cascading Country → State/Region → City selector.
// value: { country, state, city } | onChange({ country, state, city })
// required=false → drops the " *" suffix from labels (e.g. for optional filter UIs).
export default function LocationSelector({ value, onChange, errors = {}, required = true }) {
  const { country = "", state = "", city = "" } = value || {};
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const suffix = required ? " *" : "";

  useEffect(() => {
    if (!country) { setStates([]); return; }
    let active = true;
    setLoadingStates(true);
    getStatesForCountry(country).then(list => { if (active) setStates(list); }).finally(() => { if (active) setLoadingStates(false); });
    return () => { active = false; };
  }, [country]);

  useEffect(() => {
    if (!country || !state) { setCities([]); return; }
    let active = true;
    setLoadingCities(true);
    getCitiesForState(country, state).then(list => { if (active) setCities(list); }).finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [country, state]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <ComboField
        label={`Country${suffix}`}
        value={country}
        placeholder={required ? "Select country" : "Any country"}
        options={COUNTRIES}
        emptyText="No countries found"
        error={errors.country}
        onSelect={(v) => onChange({ country: v === country ? "" : v, state: "", city: "" })}
      />
      <ComboField
        label={`State / Region${suffix}`}
        value={state}
        placeholder={!country ? "Select a country first" : required ? "Select state/region" : "Any state/region"}
        disabled={!country}
        loading={loadingStates}
        options={states}
        emptyText={!country ? "Select a country first" : "No states found for this country."}
        error={errors.state}
        onSelect={(v) => onChange({ country, state: v === state ? "" : v, city: "" })}
      />
      <ComboField
        label={`City${suffix}`}
        value={city}
        placeholder={!state ? "Select a state/region first" : required ? "Select city" : "Any city"}
        disabled={!state}
        loading={loadingCities}
        options={cities}
        emptyText={!state ? "Select a state/region first" : "No cities found. Please select another state/region."}
        error={errors.city}
        onSelect={(v) => onChange({ country, state, city: v === city ? "" : v })}
      />
    </div>
  );
}