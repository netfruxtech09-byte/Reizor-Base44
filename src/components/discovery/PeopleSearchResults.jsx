import { Link } from "react-router-dom";
import { Users } from "lucide-react";

const TYPE_COLOR = {
  organizer: "text-orange-400 bg-orange-400/10",
  artist: "text-chart-3 bg-chart-3/10",
  fan: "text-accent bg-accent/10",
};

// Compact "People" result list — shown when a search matches organizer, artist,
// or public fan names. Exact single matches are auto-redirected before this renders.
export default function PeopleSearchResults({ people }) {
  if (!people?.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold text-lg text-primary">PEOPLE</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {people.map((p) => (
          <Link key={`${p.type}-${p.id}`} to={p.href}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all">
            {p.image ? (
              <img src={p.image} alt={p.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-display font-bold text-primary">{p.name[0]?.toUpperCase() || "?"}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-sm truncate">{p.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_COLOR[p.type]}`}>{p.type}</span>
                {p.subtitle && <span className="text-[10px] text-muted-foreground truncate">{p.subtitle}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}