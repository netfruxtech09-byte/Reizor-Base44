import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Search, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_STYLES = {
  active:    { label: "Available", cls: "text-green-400 bg-green-400/10" },
  sold:      { label: "Sold",      cls: "text-muted-foreground bg-muted" },
  cancelled: { label: "Cancelled", cls: "text-destructive bg-destructive/10" },
};

/**
 * ResellListingsPanel — shows resell listings for a specific event (organizer view).
 * Props:
 *   eventId (string) — filter to a single event
 *   organizerId (string) — used to verify ownership context (optional, display only)
 */
export default function ResellListingsPanel({ eventId, organizerId }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const query = eventId ? { event_id: eventId } : organizerId ? { organizer_id: organizerId } : {};
    base44.entities.TicketListing.filter(query, "-created_date", 300)
      .then(data => { setListings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [eventId, organizerId]);

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (l.ticket_code || "").toLowerCase().includes(q) ||
      (l.seller_name || "").toLowerCase().includes(q) ||
      (l.event_title || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Tag className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-lg">RESELL LISTINGS</h2>
        <span className="font-mono text-xs text-muted-foreground">({listings.length} total)</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search code, seller..."
            className="pl-9 bg-secondary border-border/50 h-8 text-sm" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3 h-3" /></button>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", "active", "sold", "cancelled"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {s === "all" ? "All" : STATUS_STYLES[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm border border-border/40 rounded-xl bg-card">
          No resell listings {statusFilter !== "all" ? `with status "${STATUS_STYLES[statusFilter]?.label}"` : ""}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Ticket Code", "Type", "Seller", "Original", "Resell Price", "Listed", "Status"].map(h => (
                      <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(listing => {
                    const st = STATUS_STYLES[listing.status] || STATUS_STYLES.cancelled;
                    return (
                      <tr key={listing.id} onClick={() => setSelected(listing)}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors cursor-pointer">
                        <td className="p-3 font-mono text-xs text-primary font-bold">{listing.ticket_code}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{listing.ticket_type_name || "—"}</td>
                        <td className="p-3">
                          {/* Mask email for organizer privacy */}
                          <p className="text-xs font-medium">{listing.seller_name || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {listing.seller_email?.replace(/(.{2}).*(@.*)/, "$1***$2")}
                          </p>
                        </td>
                        <td className="p-3 font-mono text-xs">${(listing.original_price || 0).toFixed(2)}</td>
                        <td className="p-3 font-mono text-xs font-bold text-primary">${(listing.resale_price || 0).toFixed(2)}</td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">
                          {listing.created_date ? format(new Date(listing.created_date), "MMM dd") : "—"}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(listing => {
              const st = STATUS_STYLES[listing.status] || STATUS_STYLES.cancelled;
              return (
                <div key={listing.id} onClick={() => setSelected(listing)}
                  className="p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between gap-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary font-bold">{listing.ticket_code}</p>
                    <p className="text-xs text-muted-foreground truncate">{listing.seller_name || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-primary">${(listing.resale_price || 0).toFixed(2)}</p>
                    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Detail modal (view-only for organizer) */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border max-w-sm w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="font-display font-black">Resell Listing Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-sm">
              {[
                ["Ticket Code", selected.ticket_code],
                ["Ticket Type", selected.ticket_type_name || "—"],
                ["Seller", selected.seller_name || "—"],
                ["Original Price", `$${(selected.original_price || 0).toFixed(2)}`],
                ["Resell Price", `$${(selected.resale_price || 0).toFixed(2)}`],
                ["Status", STATUS_STYLES[selected.status]?.label || selected.status],
                ["Listed On", selected.created_date ? format(new Date(selected.created_date), "MMM dd, yyyy") : "—"],
                ...(selected.sold_at ? [["Sold At", format(new Date(selected.sold_at), "MMM dd, yyyy")]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 border-b border-border/20 pb-2 last:border-0">
                  <span className="text-muted-foreground text-xs font-mono">{label}</span>
                  <span className="font-medium text-xs">{value}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}