import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Search, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS_STYLES = {
  active:    { label: "Available", cls: "text-green-400 bg-green-400/10" },
  sold:      { label: "Sold",      cls: "text-muted-foreground bg-muted" },
  cancelled: { label: "Cancelled", cls: "text-destructive bg-destructive/10" },
  expired:   { label: "Event Ended", cls: "text-yellow-600 bg-yellow-600/10" },
};

export default function AdminResell() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TicketListing.list("-created_date", 500).catch(() => []);
    
    // Check event end dates and mark expired listings
    const now = new Date();
    const processedData = data.map(listing => {
      if (listing.status === "active" && listing.event_end_date) {
        const eventEndDate = new Date(listing.event_end_date);
        if (now > eventEndDate) {
          return { ...listing, status: "expired" };
        }
      }
      return listing;
    });
    
    setListings(processedData);
    setLoading(false);
  };

  const cancelListing = async (listing) => {
    if (!window.confirm("Remove this resell listing?")) return;
    await base44.entities.TicketListing.update(listing.id, { status: "cancelled" });
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: "cancelled" } : l));
    if (selected?.id === listing.id) setSelected(s => ({ ...s, status: "cancelled" }));
    toast.success("Listing removed");
  };

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (l.ticket_code || "").toLowerCase().includes(q) ||
      (l.seller_name || "").toLowerCase().includes(q) ||
      (l.seller_email || "").toLowerCase().includes(q) ||
      (l.event_title || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchOrg = !orgFilter || (l.organizer_id || "").includes(orgFilter);
    return matchSearch && matchStatus && matchOrg;
  });

  // Unique organizer ids for filter
  const orgIds = [...new Set(listings.map(l => l.organizer_id).filter(Boolean))];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-6xl w-full overflow-x-hidden">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" /> RESELL LISTINGS
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{listings.length} total · {filtered.length} shown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search ticket code, seller, event..."
            className="pl-9 bg-card border-border/50" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "active", "sold", "expired", "cancelled"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {s === "all" ? "All" : STATUS_STYLES[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {["Ticket Code", "Event", "Seller", "Original Price", "Resell Price", "Listed", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No listings found</td></tr>
              )}
              {filtered.map(listing => {
                const st = STATUS_STYLES[listing.status] || STATUS_STYLES.cancelled;
                return (
                  <tr key={listing.id} onClick={() => setSelected(listing)}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors cursor-pointer">
                    <td className="p-3 font-mono text-xs text-primary font-bold">{listing.ticket_code}</td>
                    <td className="p-3">
                      <p className="font-medium text-xs truncate max-w-[140px]">{listing.event_title || "—"}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-xs font-medium">{listing.seller_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{listing.seller_email}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">${(listing.original_price || 0).toFixed(2)}</td>
                    <td className="p-3 font-mono text-xs font-bold text-primary">${(listing.resale_price || 0).toFixed(2)}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {listing.created_date ? format(new Date(listing.created_date), "MMM dd, yyyy") : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      {(listing.status === "active" || listing.status === "expired") && (
                        <button onClick={() => cancelListing(listing)}
                          className="text-[10px] font-mono px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No listings found</p>}
        {filtered.map(listing => {
          const st = STATUS_STYLES[listing.status] || STATUS_STYLES.cancelled;
          return (
            <div key={listing.id} onClick={() => setSelected(listing)}
              className="p-4 rounded-xl bg-card border border-border/50 space-y-2 cursor-pointer hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-primary font-bold">{listing.ticket_code}</p>
                  <p className="font-medium text-sm mt-0.5 truncate max-w-[180px]">{listing.event_title || "—"}</p>
                  <p className="text-xs text-muted-foreground">{listing.seller_name} · {listing.seller_email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold text-primary">${(listing.resale_price || 0).toFixed(2)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground line-through">${(listing.original_price || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                {listing.status === "active" && (
                  <button onClick={e => { e.stopPropagation(); cancelListing(listing); }}
                    className="text-xs font-mono px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border max-w-sm w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="font-display font-black">Resell Listing</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-sm">
              {[
                ["Ticket Code", selected.ticket_code],
                ["Event", selected.event_title || "—"],
                ["Ticket Type", selected.ticket_type_name || "—"],
                ["Seller", `${selected.seller_name || "—"} (${selected.seller_email})`],
                ["Original Price", `$${(selected.original_price || 0).toFixed(2)}`],
                ["Resell Price", `$${(selected.resale_price || 0).toFixed(2)}`],
                ["Status", STATUS_STYLES[selected.status]?.label || selected.status],
                ["Listed On", selected.created_date ? format(new Date(selected.created_date), "MMM dd, yyyy h:mm a") : "—"],
                ...(selected.sold_at ? [["Sold At", format(new Date(selected.sold_at), "MMM dd, yyyy")]] : []),
                ...(selected.sold_to_email ? [["Sold To", selected.sold_to_email]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-mono">{label}</span>
                  <span className="font-medium text-xs text-right">{value}</span>
                </div>
              ))}
              {(selected.status === "active" || selected.status === "expired") && (
                <Button onClick={() => cancelListing(selected)} variant="outline"
                  className="w-full mt-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                  Remove Listing
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}