export default function SpotifyWidget({ spotifyUrl }) {
  if (!spotifyUrl) return null;

  // Convert open.spotify.com URL to embed URL
  // e.g. https://open.spotify.com/artist/xyz -> https://open.spotify.com/embed/artist/xyz
  let embedUrl = spotifyUrl;
  try {
    const url = new URL(spotifyUrl);
    if (url.hostname.includes("spotify.com")) {
      embedUrl = `https://open.spotify.com/embed${url.pathname}?utm_source=generator&theme=0`;
    }
  } catch {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="font-display font-bold text-lg flex items-center gap-2">
        <span className="text-green-400">▶</span> ON SPOTIFY
      </h2>
      <div className="rounded-xl overflow-hidden border border-border/50">
        <iframe
          src={embedUrl}
          width="100%"
          height="352"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block"
        />
      </div>
    </div>
  );
}