import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Users, MapPin, ArrowRight, ChevronRight } from "lucide-react";
import useInView from "@/hooks/useInView";
import SeeAllButton from "./SeeAllButton";



export default function OrganizerSection({ events: propEvents, organizerProfiles: propProfiles, listOrgRes: propListOrgRes, loading: propLoading }) {
  const loading = propLoading ?? false;
  const fetched = !propLoading && propEvents !== undefined;

  const organizers = useMemo(() => {
    if (!fetched || !propListOrgRes) return null;
    const profiles = propProfiles || [];
    const events = propEvents || [];
    const organizerLookup = {};
    (propListOrgRes?.data?.organizers || []).forEach((o) => {
      organizerLookup[String(o.organizer_id)] = o;
    });
    const organizerIds = new Set(Object.keys(organizerLookup));
    const result = [];
    for (const oid of organizerIds) {
      const profile = profiles.find((p) => String(p.organizer_id) === oid);
      const orgInfo = organizerLookup[oid];
      const orgEvents = events.filter((e) => String(e.organizer_id) === oid && e.status === "published");
      if (orgEvents.length === 0 && !profile && !orgInfo) continue;
      const displayName = profile?.business_name || profile?.full_name || orgInfo?.business_name || orgInfo?.full_name || `Organizer-${oid.slice(0, 8)}`;
      const location = [profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ") || orgEvents[0]?.city || "";
      result.push({
        id: oid, name: displayName, image: profile?.profile_image || "", location,
        city: profile?.city || orgEvents[0]?.city || "",
        country: profile?.country || orgEvents[0]?.country || "",
        eventCount: orgEvents.length, bio: profile?.bio || "",
      });
    }
    result.sort((a, b) => b.eventCount - a.eventCount);
    return result;
  }, [fetched, propProfiles, propEvents, propListOrgRes]);

  const [containerRef] = useInView();

  if (loading || !fetched) {
    return (
      <section ref={containerRef} className="px-4 sm:px-6 max-w-7xl mx-auto py-10">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-28 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border/50 rounded-xl p-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-2.5 w-28 bg-muted rounded mt-1.5" />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                <div className="h-2 w-16 bg-muted rounded" />
                <div className="w-3 h-3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!organizers || organizers.length === 0) return null;

  const preview = organizers.slice(0, 4);

  return (
    <section ref={containerRef} className="px-4 sm:px-6 max-w-7xl mx-auto py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ DISCOVER</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">ORGANIZERS</h2>
        </div>
        <SeeAllButton to="/organizers" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {preview.map((org) => (
          <Link key={org.id} to={`/organizers/${org.id}`}
            className="bg-card border border-border/50 rounded-xl p-3 hover:border-primary/40 hover:bg-card/80 hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 overflow-hidden shrink-0">
              {org.image ? <img src={org.image} alt={org.name} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-primary" />}
            </div>
            <h3 className="font-display font-bold text-xs truncate group-hover:text-primary transition-colors">{org.name}</h3>
            {org.location && (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 truncate font-mono leading-tight">
                <MapPin className="w-2.5 h-2.5 shrink-0" />{org.location}
              </p>
            )}
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/20">
              <span className="font-mono text-[9px] text-muted-foreground">{org.eventCount} event{org.eventCount !== 1 ? "s" : ""}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}