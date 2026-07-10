/**
 * Metadata formatting utilities — standardize role/genre/category display across the app.
 * Format: UPPERCASE · UPPERCASE (e.g., "ARTIST · TRANCE · PSYTRANCE", "ORGANIZER · FESTIVAL")
 * Display names (artist/organizer names) are never uppercased — only metadata labels.
 */

// Format a comma-separated genre string into uppercase · -separated display.
// "trance, psytrance" → "TRANCE · PSYTRANCE"
export function formatGenres(genreStr) {
  if (!genreStr) return "";
  return genreStr
    .split(",")
    .map((g) => g.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
}

// Format artist metadata: "ARTIST · GENRE · GENRE" (or just "ARTIST" if no genre)
export function formatArtistMeta(genreStr) {
  const genres = formatGenres(genreStr);
  return genres ? `ARTIST · ${genres}` : "ARTIST";
}

// Format organizer metadata: "ORGANIZER · CATEGORY" (or just "ORGANIZER" if no category)
export function formatOrganizerMeta(category) {
  if (!category) return "ORGANIZER";
  const cat = category.replace(/_/g, " ").trim().toUpperCase();
  return `ORGANIZER · ${cat}`;
}