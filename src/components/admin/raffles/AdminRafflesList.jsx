import { useState } from "react";
import { Search, X, Ticket, Trash2, Eye, Edit2, Users, Copy, Check, Link2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import AdminRaffleDetail from "./AdminRaffleDetail";
import AdminEditRaffleModal from "./AdminEditRaffleModal";
import { getAppUrl } from "@/lib/appUrl";
import { computeStatus } from "@/utils/statusUtils";

const PAGE_SIZE = 10;

export default function AdminRafflesList({ raffles, events, onRefresh, onCreateRaffle, STATUS_BADGE, initialStatusFilter = "all" }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editRaffle, setEditRaffle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [openingId, setOpeningId] = useState(null);

  const [copiedId, setCopiedId] = useState(null);
  const eventMap = Object.fromEntries(events.map(e => [e.id, e.title]));

  const copyLink = (id) => {
    navigator.clipboard.writeText(getAppUrl(`/raffle/${id}`));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = raffles
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || (r.name || "").toLowerCase().includes(q) || (r.event_title || "").toLowerCase().includes(q);
      const effectiveStatus = computeStatus(r);
      const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.EventRaffle.delete(confirmDelete.id);
      toast.success("Raffle deleted");
      setConfirmDelete(null);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not delete this raffle. It may have already been removed.");
      onRefresh();
    }
    setDeleting(false);
  };

  const handleStatusChange = async (raffle, newStatus) => {
    try {
      await base44.entities.EventRaffle.update(raffle.id, { status: newStatus });
      toast.success(`Raffle ${newStatus}`);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not update this raffle's status.");
    }
  };

  // View Details — always fetch the freshest copy of this exact raffle by ID before opening,
  // so the panel never shows stale data and reports clearly if the raffle was deleted elsewhere.
  const handleViewDetails = async (raffle) => {
    setOpeningId(raffle.id);
    try {
      const fresh = await base44.entities.EventRaffle.filter({ id: raffle.id }, null, 1);
      if (!fresh[0]) {
        toast.error("This raffle no longer exists.");
        onRefresh();
      } else {
        setSelected(fresh[0]);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not open this raffle. Please try again.");
    }
    setOpeningId(null);
  };

  const handlePublicPreview = (raffle) => {
    window.open(getAppUrl(`/raffle/${raffle.id}`), "_blank", "noopener,noreferrer");
  };

  if (selected) return (
    <AdminRaffleDetail raffle={selected} onBack={() => { setSelected(null); onRefresh(); }} STATUS_BADGE={STATUS_BADGE} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-xl flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" /> ALL RAFFLES
          <span className="font-mono text-sm text-muted-foreground font-normal">({raffles.length})</span>
        </h2>
        <Button onClick={onCreateRaffle} className="gap-2 font-display font-bold">
          <Ticket className="w-4 h-4" /> New Raffle
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search raffle, event..." className="pl-9 bg-card border-border/50" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "upcoming", "active", "ended", "drawn", "cancelled"].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-x-auto">
        <div>
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {["Type", "Event", "Raffle Name", "Entries", "End Date", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No raffles found</td></tr>
              )}
              {paginated.map(raffle => (
                <tr key={raffle.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="p-3">
                    {raffle.event_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent whitespace-nowrap">
                        <Link2 className="w-2.5 h-2.5" /> Event
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary whitespace-nowrap">
                        <Ticket className="w-2.5 h-2.5" /> Standalone
                      </span>
                    )}
                  </td>
                   <td className="p-3 text-xs truncate max-w-[120px]">{raffle.event_title || eventMap[raffle.event_id] || "—"}</td>
                  <td className="p-3">
                    <p className="font-medium text-xs">{raffle.name || "—"}</p>
                    {raffle.prize_description && <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{raffle.prize_description}</p>}
                  </td>
                  <td className="p-3 font-mono text-xs">{raffle.total_entries || 0}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {raffle.end_datetime ? format(new Date(raffle.end_datetime), "MMM dd, yyyy") : "—"}
                  </td>
                  <td className="p-3">
                    {(() => { const s = computeStatus(raffle); return (
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[s] || STATUS_BADGE.upcoming}`}>
                        {s}
                      </span>
                    ); })()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => copyLink(raffle.id)} title="Copy share link"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        {copiedId === raffle.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditRaffle(raffle)} title="Edit Raffle"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleViewDetails(raffle)} title="View Details" disabled={openingId === raffle.id}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50">
                        {openingId === raffle.id ? <div className="w-3.5 h-3.5 border-2 border-muted-foreground/40 border-t-foreground rounded-full animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handlePublicPreview(raffle)} title="Open Public Preview"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(raffle)} title="Delete"
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={page === p ? "default" : "outline"} size="sm" onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRaffle && (
        <AdminEditRaffleModal
          raffle={editRaffle}
          events={events}
          onClose={() => setEditRaffle(null)}
          onSaved={() => { setEditRaffle(null); onRefresh(); }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Delete Raffle?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <strong>{confirmDelete?.name}</strong>. This cannot be undone.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}