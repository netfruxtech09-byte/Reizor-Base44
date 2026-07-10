import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useInView from "@/hooks/useInView";
import { isActivePublishedEvent } from "@/utils/eventUtils";

const GENRES = [
  { key: "techno", label: "TECHNO", color: "from-cyan-500/20 to-transparent" },
  { key: "house", label: "HOUSE", color: "from-primary/20 to-transparent" },
  { key: "drum_and_bass", label: "D&B", color: "from-orange-500/20 to-transparent" },
  { key: "hip_hop", label: "HIP HOP", color: "from-purple-500/20 to-transparent" },
  { key: "electronic", label: "ELECTRONIC", color: "from-blue-500/20 to-transparent" },
  { key: "trance", label: "TRANCE", color: "from-pink-500/20 to-transparent" },
  { key: "latin", label: "LATIN", color: "from-red-500/20 to-transparent" },
  { key: "rock", label: "ROCK", color: "from-amber-500/20 to-transparent" },
  { key: "rnb", label: "R&B", color: "from-indigo-500/20 to-transparent" },
  { key: "pop", label: "POP", color: "from-rose-500/20 to-transparent" },
  { key: "jazz", label: "JAZZ", color: "from-yellow-500/20 to-transparent" },
  { key: "reggaeton", label: "REGGAETON", color: "from-lime-500/20 to-transparent" },
  { key: "afrobeats", label: "AFROBEATS", color: "from-emerald-500/20 to-transparent" },
  { key: "other", label: "OTHER", color: "from-gray-500/20 to-transparent" },
];

export default function GenreRibbon({ events: propEvents, loading: propLoading }) {
  const events = propEvents || null;
  const loading = propLoading ?? false;

  const [containerRef] = useInView();

  const genreCounts = {};
  (events || []).forEach((e) => {
    if (e.genre && isActivePublishedEvent(e)) genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
  });
  const activeGenres = GENRES.filter((g) => (genreCounts[g.key] || 0) > 0);

  if (loading) {
    return (
      <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="mb-6 mt-2 space-y-2">
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          <div className="h-8 w-72 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-lg bg-card border border-border/50 p-6 animate-pulse">
              <div className="h-6 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded mt-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!events || events.length === 0 || activeGenres.length === 0) {
    return null;
  }

  return (
    <section ref={containerRef} className="py-8 sm:py-12 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="mb-6">
        <span className="font-mono text-xs text-accent tracking-[0.3em] uppercase">★ EXPLORE BY VIBE</span>
        <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1 leading-tight">FIND YOUR EVENT FREQUENCY</h2>
      </div>

      {/* Genre grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {activeGenres.map((genre, i) => (
          <motion.div key={genre.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}>
            <Link to={`/search?genre=${genre.key}`}
              className={`group block relative overflow-hidden rounded-lg border border-border/50 hover:border-primary/40 transition-all duration-300 bg-gradient-to-br ${genre.color} bg-card p-6`}>
              <span className="font-display font-black text-xl sm:text-2xl tracking-tight group-hover:text-primary transition-colors">{genre.label}</span>
              <div className="font-mono text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">EVENTS →</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}