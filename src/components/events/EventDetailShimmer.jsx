/**
 * Shimmer skeleton placeholder shown during pull-to-refresh on the Event Detail page.
 * Mirrors the real layout (hero + main info + ticket sidebar) so the refresh feels
 * smooth and never shows a jarring full-screen spinner.
 */
export default function EventDetailShimmer() {
  return (
    <>
      {/* Hero shimmer */}
      <div className="relative w-full bg-muted/40" style={{ height: "280px" }}>
        <div className="absolute inset-0 shimmer" />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-3 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info shimmer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="h-6 w-2/3 shimmer rounded-md" />
            <div className="h-14 w-full shimmer rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 shimmer rounded-lg" />
              ))}
            </div>
            <div className="h-28 shimmer rounded-xl" />
            <div className="h-36 shimmer rounded-xl" />
            <div className="h-24 shimmer rounded-xl" />
          </div>
          {/* Ticket sidebar shimmer */}
          <div className="lg:col-span-1">
            <div className="h-72 shimmer rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}