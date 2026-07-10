import { useState, useMemo } from "react";
import { Trophy, TrendingUp, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const SORT_OPTIONS = [
  { value: "revenue", label: "Total Revenue" },
  { value: "tickets", label: "Tickets Sold" },
  { value: "tables", label: "Tables Sold" },
  { value: "commission", label: "Commission Earned" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

export default function TopSellersTab({ links = [], events = [] }) {
  const [sortBy, setSortBy] = useState("revenue");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ranked = useMemo(() => {
    let list = [...links];

    // Filters
    if (eventFilter !== "all") list = list.filter(l => l.event_id === eventFilter);
    if (statusFilter !== "all") list = list.filter(l => l.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.promoter_name?.toLowerCase().includes(q) ||
        l.promoter_email?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter(l => !l.created_date || new Date(l.created_date) >= new Date(dateFrom));
    if (dateTo) list = list.filter(l => !l.created_date || new Date(l.created_date) <= new Date(dateTo + "T23:59:59"));

    // Sort
    list.sort((a, b) => {
      if (sortBy === "revenue") return (b.total_revenue || 0) - (a.total_revenue || 0);
      if (sortBy === "tickets") return (b.tickets_sold || 0) - (a.tickets_sold || 0);
      if (sortBy === "tables") return (b.tables_sold || 0) - (a.tables_sold || 0);
      if (sortBy === "commission") return (b.commission_earned || 0) - (a.commission_earned || 0);
      return 0;
    });

    return list;
  }, [links, sortBy, eventFilter, statusFilter, search, dateFrom, dateTo]);

  const topValue = ranked[0]?.[
    sortBy === "revenue" ? "total_revenue" :
    sortBy === "tickets" ? "tickets_sold" :
    sortBy === "tables" ? "tables_sold" : "commission_earned"
  ] || 0;

  if (links.length === 0) {
    return (
      <div className="py-16 rounded-xl bg-card border border-border/50 text-center space-y-3 px-6">
        <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
          <Trophy className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <p className="font-display font-bold text-lg">No Sellers Yet</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Create ticket sellers to start tracking performance rankings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Search</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name or email..." className="pl-8 bg-card border-border/50 text-sm" />
          </div>
        </div>
        {/* Sort */}
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Rank By</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Event */}
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Event</Label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Status */}
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Created From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 bg-card border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Created To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 bg-card border-border/50 text-sm" />
        </div>
      </div>

      {/* Rankings */}
      {ranked.length === 0 ? (
        <div className="py-12 rounded-xl bg-card border border-border/50 text-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-mono text-sm">No sellers match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranked.map((link, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            const eventTitle = events.find(e => e.id === link.event_id)?.title || link.event_title || null;
            const isExpired = link.expiry_date && new Date(link.expiry_date) < new Date();
            const isActive = link.status === "active" && !isExpired;

            const currentValue = sortBy === "revenue" ? (link.total_revenue || 0) :
              sortBy === "tickets" ? (link.tickets_sold || 0) :
              sortBy === "tables" ? (link.tables_sold || 0) :
              (link.commission_earned || 0);
            const barWidth = topValue > 0 ? Math.round((currentValue / topValue) * 100) : 0;

            return (
              <div
                key={link.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  rank === 1 ? "border-yellow-400/40 bg-yellow-400/5" :
                  rank === 2 ? "border-slate-400/40 bg-slate-400/5" :
                  rank === 3 ? "border-amber-600/40 bg-amber-600/5" :
                  "border-border/50 bg-card"
                }`}
              >
                <div className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {/* Rank badge */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono font-black text-sm ${
                      rank === 1 ? "bg-yellow-400/20 text-yellow-400" :
                      rank === 2 ? "bg-slate-400/20 text-slate-300" :
                      rank === 3 ? "bg-amber-600/20 text-amber-500" :
                      "bg-muted/40 text-muted-foreground"
                    }`}>
                      {isTop3 ? MEDAL[rank - 1] : `#${rank}`}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm leading-tight truncate">{link.promoter_name}</p>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          isActive ? "text-green-400 bg-green-400/10 border border-green-400/20" :
                          "text-muted-foreground bg-muted border border-border/40"
                        }`}>
                          {isExpired ? "EXPIRED" : link.status.toUpperCase()}
                        </span>
                      </div>

                      {link.promoter_email && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{link.promoter_email}</p>
                      )}
                      <p className="text-[10px] text-primary/70 font-mono mt-0.5 truncate">
                        {eventTitle || <span className="italic text-muted-foreground/50">All Events</span>}
                      </p>
                      {link.created_date && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                          Since {format(new Date(link.created_date), "MMM d, yyyy")}
                        </p>
                      )}

                      {/* Performance bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rank === 1 ? "bg-yellow-400" :
                              rank === 2 ? "bg-slate-300" :
                              rank === 3 ? "bg-amber-500" :
                              "bg-primary"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{barWidth}%</span>
                      </div>
                    </div>

                    {/* Primary metric (highlighted) */}
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-black text-lg leading-tight ${
                        rank === 1 ? "text-yellow-400" :
                        rank === 2 ? "text-slate-300" :
                        rank === 3 ? "text-amber-500" :
                        "text-foreground"
                      }`}>
                        {sortBy === "revenue" || sortBy === "commission"
                          ? `$${currentValue.toFixed(2)}`
                          : currentValue}
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground">
                        {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-1 mt-3 pt-3 border-t border-border/20">
                    {[
                      { label: "Tickets", val: link.tickets_sold || 0, isNum: true },
                      { label: "Tables", val: link.tables_sold || 0, isNum: true },
                      { label: "Revenue", val: `$${(link.total_revenue || 0).toFixed(2)}`, isNum: false },
                      { label: "Commission", val: `$${(link.commission_earned || 0).toFixed(2)}`, isNum: false },
                    ].map(({ label, val }) => (
                      <div key={label} className="text-center">
                        <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="font-mono font-bold text-xs mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}