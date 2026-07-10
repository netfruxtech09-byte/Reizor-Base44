// Normalizes country/city names so analytics charts don't show duplicate
// entries caused by spacing, casing, abbreviations, or alternate names.

const COUNTRY_ALIASES = {
  "usa": "United States",
  "u.s.a.": "United States",
  "u.s.a": "United States",
  "us": "United States",
  "u.s.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  "uae": "United Arab Emirates",
  "u.a.e.": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
};

function collapseSpaces(str) {
  return str.trim().replace(/\s+/g, " ");
}

// Returns a standardized display label for a country name.
export function normalizeCountry(raw) {
  if (!raw) return "Unknown";
  const cleaned = collapseSpaces(String(raw));
  const key = cleaned.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return cleaned;
}

// Returns a standardized display label for a city name (trims/collapses
// spacing and normalizes casing differences so "new york" and "New York"
// merge into one entry).
export function normalizeCity(raw) {
  if (!raw) return "Unknown";
  const cleaned = collapseSpaces(String(raw));
  return cleaned.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Groups items into { label -> count } using a normalizer, merging
// duplicates that only differ by spacing/casing/aliases.
export function groupByNormalizedLocation(items, getRawValue, normalizer) {
  const map = {};
  items.forEach((item) => {
    const label = normalizer(getRawValue(item));
    map[label] = (map[label] || 0) + 1;
  });
  return map;
}