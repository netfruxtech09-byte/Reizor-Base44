/**
 * EventCoverPlaceholder — reusable placeholder for events with no cover image
 * Used in EventCard, EventDetail, and other event displays
 */
export default function EventCoverPlaceholder({ featured = false }) {
  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 overflow-hidden`}>
      <div className="text-center space-y-2 px-6 py-8">
        <div className={`${featured ? "text-6xl" : "text-4xl"} opacity-60`}>🎵</div>
        <p className={`font-display font-bold text-foreground/50 ${featured ? "text-base" : "text-sm"} whitespace-nowrap`}>
          No Cover Image
        </p>
      </div>

      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}