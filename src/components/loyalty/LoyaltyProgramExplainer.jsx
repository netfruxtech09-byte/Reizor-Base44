import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Ticket, Percent, DollarSign, Users, Star, Gift, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const REWARD_LABELS = {
  free_ticket: { label: "Free Ticket", icon: Ticket, color: "text-green-400" },
  discount: { label: "Discount", icon: Percent, color: "text-accent" },
  backstage_access: { label: "Backstage Access", icon: Users, color: "text-yellow-400" },
  credit: { label: "Credit", icon: DollarSign, color: "text-primary" },
  custom: { label: "Custom Reward", icon: Gift, color: "text-purple-400" },
  none: { label: "Recognition", icon: Star, color: "text-muted-foreground" },
};

export default function LoyaltyProgramExplainer({ userEmail, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [orgPrograms, setOrgPrograms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userEmail) return;
    setLoading(true);

    (async () => {
      // Load all organizer loyalty tiers
      const allTiers = await base44.entities.OrganizerLoyaltyTier.list("tier_number", 200).catch(() => []);
      if (allTiers.length === 0) { setOrgPrograms([]); setLoading(false); return; }

      // Load all scanned tickets for this user
      const scannedTickets = await base44.entities.Ticket.filter(
        { owner_email: userEmail, status: "scanned" }, null, 500
      ).catch(() => []);

      // Get unique event IDs from scanned tickets
      const scannedEventIds = [...new Set(scannedTickets.map(t => t.event_id).filter(Boolean))];

      // Load events for those tickets to know the organizer
      let eventsMap = {};
      if (scannedEventIds.length > 0) {
        // Batch: fetch events for each attended event
        const eventsArr = await Promise.all(
          scannedEventIds.map(eid =>
            base44.entities.Event.filter({ id: eid }, null, 1).catch(() => [])
          )
        );
        eventsArr.forEach(arr => { if (arr[0]) eventsMap[arr[0].id] = arr[0]; });
      }

      // Count attended events per organizer (deduplicated by event_id)
      const attendedByOrg = {}; // organizer_id -> Set of event_ids attended
      for (const ticket of scannedTickets) {
        const event = eventsMap[ticket.event_id];
        if (!event) continue;
        if (!attendedByOrg[event.organizer_id]) attendedByOrg[event.organizer_id] = new Set();
        attendedByOrg[event.organizer_id].add(event.id);
      }

      // Group tiers by organizer
      const orgMap = {};
      for (const tier of allTiers) {
        if (!orgMap[tier.organizer_id]) {
          orgMap[tier.organizer_id] = {
            organizer_id: tier.organizer_id,
            organizer_name: tier.organizer_name || "Organizer",
            tiers: [],
          };
        }
        orgMap[tier.organizer_id].tiers.push(tier);
      }

      // Build final list with per-organizer attended counts
      const programs = Object.values(orgMap).map(org => {
        const attended = attendedByOrg[org.organizer_id]?.size || 0;
        const sortedTiers = org.tiers.sort((a, b) => a.tier_number - b.tier_number);
        // Determine current tier (highest reached)
        const currentTier = [...sortedTiers].reverse().find(t => attended >= (t.events_required || 0));
        // Next tier (first not reached)
        const nextTier = sortedTiers.find(t => attended < (t.events_required || 0));
        return { ...org, tiers: sortedTiers, attended, currentTier, nextTier };
      });

      // Only show organizers that have loyalty tiers set up
      setOrgPrograms(programs);
      setLoading(false);
    })();
  }, [open, userEmail]);

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Event Attendance & Rewards</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border/30">
          {/* How it works */}
          <div className="pt-4 space-y-1">
            <p className="font-display font-bold text-sm">How Organizer Rewards Programs Work</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Each event organizer can run their own rewards program. Attend their events to reach higher reward tiers and unlock exclusive benefits. Progress is tracked separately per organizer.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : orgPrograms.length === 0 ? (
            <div className="text-center py-6 space-y-1">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground font-mono">No rewards programs available yet.</p>
              <p className="text-xs text-muted-foreground">Attend events and organizers' rewards programs will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Your rewards programs are grouped by organizer.
              </p>
              {orgPrograms.map((org) => (
                <OrganizerLoyaltyCard key={org.organizer_id} org={org} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrganizerLoyaltyCard({ org }) {
  const [expanded, setExpanded] = useState(false);

  const currentTier = org.currentTier;
  const nextTier = org.nextTier;

  // Progress to next tier
  let progressPct = 0;
  if (nextTier && nextTier.events_required > 0) {
    const prevRequired = currentTier?.events_required || 0;
    progressPct = Math.min(100, Math.round(
      ((org.attended - prevRequired) / (nextTier.events_required - prevRequired)) * 100
    ));
  } else if (!nextTier && org.attended > 0) {
    progressPct = 100;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Card header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm truncate">{org.organizer_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{org.tiers.length} tier{org.tiers.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xs font-bold text-primary">{org.attended} event{org.attended !== 1 ? "s" : ""}</p>
            <p className="font-mono text-[10px] text-muted-foreground">attended</p>
          </div>
        </div>

        {/* Current tier badge */}
        {currentTier ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
              {currentTier.tier_number}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-bold text-primary">Current: {currentTier.tier_name}</p>
              {currentTier.reward_type && currentTier.reward_type !== "none" && (() => {
                const r = REWARD_LABELS[currentTier.reward_type] || REWARD_LABELS.none;
                const RIcon = r.icon;
                return (
                  <p className={`text-[10px] font-mono flex items-center gap-1 mt-0.5 ${r.color}`}>
                    <RIcon className="w-2.5 h-2.5" />
                    {r.label}
                    {currentTier.reward_type === "discount" && currentTier.reward_value ? ` — ${currentTier.reward_value}% off` : ""}
                    {currentTier.reward_type === "credit" && currentTier.reward_value ? ` — $${currentTier.reward_value}` : ""}
                    {currentTier.reward_type === "custom" && currentTier.custom_reward ? `: ${currentTier.custom_reward}` : ""}
                  </p>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
            <p className="font-mono text-[10px] text-muted-foreground">
              Attend {org.tiers[0]?.events_required || 1} event{(org.tiers[0]?.events_required || 1) !== 1 ? "s" : ""} to reach {org.tiers[0]?.tier_name || "Tier 1"}
            </p>
          </div>
        )}

        {/* Progress to next tier */}
        {nextTier && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>{org.attended} attended</span>
              <span>{nextTier.events_required - org.attended} more → {nextTier.tier_name}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        {!nextTier && org.attended > 0 && (
          <p className="font-mono text-[10px] text-yellow-400">🏆 Max tier reached!</p>
        )}

        {/* View Details toggle + View full program link */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border/40 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide Details" : "View All Tiers"}
          </button>
          <Link
            to={`/organizers/${org.organizer_id}?section=rewards`}
            className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-yellow-400/30 text-xs font-mono text-yellow-400 hover:bg-yellow-400/10 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3 h-3" /> View Program
          </Link>
        </div>
      </div>

      {/* Expanded: all tiers */}
      {expanded && (
        <div className="border-t border-border/30 px-4 pb-4 pt-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">All Tiers</p>
          {org.tiers.map((tier) => {
            const reached = org.attended >= (tier.events_required || 0);
            const reward = REWARD_LABELS[tier.reward_type] || REWARD_LABELS.none;
            const RewardIcon = reward.icon;
            return (
              <div
                key={tier.id || tier.tier_number}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  reached ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                  reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {tier.tier_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-xs">{tier.tier_name}</p>
                    {reached && (
                      <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase">Reached ✓</span>
                    )}
                  </div>
                  {tier.events_required > 0 && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {tier.events_required} event{tier.events_required !== 1 ? "s" : ""} required
                    </p>
                  )}
                  {tier.description && (
                    <p className="text-[11px] text-muted-foreground mt-1">{tier.description}</p>
                  )}
                  {tier.reward_type && tier.reward_type !== "none" && (
                    <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] font-mono font-bold ${reward.color}`}>
                      <RewardIcon className="w-3 h-3" />
                      <span>
                        {reward.label}
                        {tier.reward_type === "discount" && tier.reward_value ? ` — ${tier.reward_value}% off` : ""}
                        {tier.reward_type === "credit" && tier.reward_value ? ` — $${tier.reward_value}` : ""}
                        {tier.reward_type === "custom" && tier.custom_reward ? `: ${tier.custom_reward}` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}