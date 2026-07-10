import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";

const FEATURES = [
  { label: "Easy artist booking & management", path: "/artist/bookings" },
  { label: "Website embed code for your site", path: "/artist/embed" },
  { label: "Tour schedule posting", path: "/artist/tour" },
  { label: "Post 360° videos & media gallery", path: "/artist/gallery" },
  { label: "AI flyer & 3D video creation", path: "/artist" },
  { label: "Direct fan communication", path: "/artist/inbox" },
  { label: "Merch & digital downloads shop", path: "/artist/merch" },
  { label: "Fan support & donations", path: "/artist/donations" },
  { label: "Loyalty tiers for your fanbase", path: "/artist/tiers" },
  { label: "Follow Me — notify nearby organizers", path: "/artist" },
  { label: "Raffle & giveaway tools", path: "/artist/raffles" },
  { label: "Full P&L analytics", path: "/artist/pl" },
];

export default function ArtistFeaturesCard() {
  return (
    <div className="rounded-2xl bg-card border border-primary/20 overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border/30 flex items-center justify-between gap-2">
        <div>
          <span className="font-mono text-[10px] text-primary tracking-[0.25em] uppercase">★ Your Studio</span>
          <h3 className="font-display font-black text-base mt-0.5">What You Can Do</h3>
        </div>
        <Link to="/artist"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-all shrink-0">
          Studio <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {FEATURES.map((f, i) => (
          <Link key={i} to={f.path}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="group-hover:underline leading-snug">{f.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}