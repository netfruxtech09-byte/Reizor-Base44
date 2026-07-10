import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { DollarSign, TrendingUp, ExternalLink, Calendar, MapPin, ChevronDown, ChevronUp } from "lucide-react";

export default function AffiliateEarningsReport() {
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const user = await base44.auth.me();
      const data = await base44.entities.AffiliateEarning.filter(
        { click_user_email: user.email },
        "-created_date",
        1000
      ).catch(() => []);
      setEarnings(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter by period
  const now = new Date();
  const filtered = earnings.filter((e) => {
    if (period === "all") return true;
    const d = new Date(e.created_date);
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "year") return d.getFullYear() === now.getFullYear();
    return true;
  });

  // Group by event
  const byEvent = filtered.reduce((acc, e) => {
    const key = e.event_title || e.external_event_id || "Unknown Event";
    if (!acc[key]) acc[key] = { title: key, clicks: 0, conversions: 0, earned: 0, rows: [] };
    acc[key].rows.push(e);
    acc[key].earned += e.amount || 0;
    if (e.action === "click") acc[key].clicks += 1;
    if (e.action === "conversion") acc[key].conversions += 1;
    return acc;
  }, {});

  const eventGroups = Object.entries(byEvent).sort((a, b) => b[1].earned - a[1].earned);

  const totalEarned = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalClicks = filtered.filter(e => e.action === "click").length;
  const totalConversions = filtered.filter(e => e.action === "conversion").length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">AFFILIATE INCOME</h1>
        <p className="text-sm text-muted-foreground mt-1">Earnings from events you promoted</p>
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {[["all", "All Time"], ["month", "This Month"], ["year", "This Year"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
              period === val
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 bg-card text-muted-foreground hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
          <DollarSign className="w-4 h-4 text-primary mb-2" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Total Earned</p>
          <p className="font-mono text-2xl font-black text-primary mt-1">${totalEarned.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <TrendingUp className="w-4 h-4 text-accent mb-2" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Clicks</p>
          <p className="font-mono text-2xl font-black text-accent mt-1">{totalClicks}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <ExternalLink className="w-4 h-4 text-green-400 mb-2" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Conversions</p>
          <p className="font-mono text-2xl font-black text-green-400 mt-1">{totalConversions}</p>
        </div>
      </div>

      {/* Events breakdown */}
      {eventGroups.length === 0 ? (
        <div className="p-10 rounded-xl bg-card border border-border/50 text-center">
          <p className="text-muted-foreground text-sm">No affiliate earnings for this period.</p>
          <p className="text-xs text-muted-foreground mt-1">Start promoting partner events to earn commissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg">PROMOTED EVENTS</h2>
          {eventGroups.map(([key, group]) => (
            <div key={key} className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <button
                onClick={() => setExpandedEvent(expandedEvent === key ? null : key)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">{group.title}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {group.clicks} click{group.clicks !== 1 ? "s" : ""} · {group.conversions} conversion{group.conversions !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-black text-primary">${group.earned.toFixed(2)}</span>
                  {expandedEvent === key
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedEvent === key && (
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {group.rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground capitalize">{row.action}</p>
                        {row.created_date && (
                          <p className="text-xs text-muted-foreground">{format(new Date(row.created_date), "MMM dd, yyyy · HH:mm")}</p>
                        )}
                      </div>
                      <p className="font-mono font-bold text-green-400">+${(row.amount || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}