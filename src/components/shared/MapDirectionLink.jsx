import { MapPin } from "lucide-react";

/**
 * MapDirectionLink — renders a clickable Google Maps directions/search link.
 *
 * Props:
 *   venueName  — venue/place name
 *   address    — street address
 *   city       — city
 *   state      — state/province
 *   country    — country
 *   postalCode — postal/zip code
 *   latitude   — GPS latitude (preferred over address)
 *   longitude  — GPS longitude (preferred over address)
 *   label      — link label text (default: "Get Directions")
 *   className  — extra classes
 *   compact    — if true, shows icon-only with shorter label
 */
export default function MapDirectionLink({
  venueName,
  address,
  city,
  state,
  country,
  postalCode,
  latitude,
  longitude,
  label,
  className = "",
  compact = false,
}) {
  // Build Google Maps URL — prefer coordinates, fall back to address search
  const buildUrl = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Coordinates available: use Google Maps with marker
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    // Build a full address string from available parts
    const parts = [venueName, address, city, state, postalCode, country].filter(Boolean);
    if (parts.length === 0) return null;

    const query = encodeURIComponent(parts.join(", "));
    return `https://www.google.com/maps/search/${query}`;
  };

  const url = buildUrl();
  if (!url) return null;

  const displayLabel = label || (compact ? "Map" : "Get Directions");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 font-bold text-primary hover:text-primary/80 hover:underline transition-colors ${className}`}
      title="Open in Google Maps"
    >
      <MapPin className="w-3.5 h-3.5 shrink-0" />
      <span>{displayLabel}</span>
    </a>
  );
}