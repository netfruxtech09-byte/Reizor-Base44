import { useState } from "react";
import { Search, X, BarChart3, Trash2, Eye, Copy, Check, Link2, Play, Square as Stop, Pencil } from "lucide-react";
import AdminEditPollModal from "./AdminEditPollModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import AdminPollDetail from "./AdminPollDetail";
import { getAppUrl } from "@/lib/appUrl";
import { computeStatus } from "@/utils/statusUtils";

const PAGE_SIZE = 10;

export default function AdminPollsList({ polls, events, onRefresh, onCreatePoll, STATUS_BADGE, initialStatusFilter = "all" }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmEndPoll, setConfirmEndPoll] = useState(null);
  const [updatingPollId, setUpdatingPollId] = useState(null);
  const [editPoll, setEditPoll] = useState(null);

  const [copiedId, setCopiedId] = useState(null);
  const eventMap = Object.fromEntries(events.map(e => [e.id, e.title]));

  const copyLink = (id) => {
    navigator.clipboard.writeText(getAppUrl(`/poll/${id}`));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = polls
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || (p.question || "").toLowerCase().includes(q) || (p.event_title || "").toLowerCase().includes(q);
      const effectiveStatus = computeStatus(p);
      const matchStatus = statusFilter === "all" || effectiveStatus === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => (a.question || "").localeCompare(b.question || ""));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.EventPoll.delete(confirmDelete.id);
    toast.success("Poll deleted");
    setConfirmDelete(null);
    setDeleting(false);
    onRefresh();
  };

  const handleStatusChange = async (poll, newStatus) => {
    try {
      setUpdatingPollId(poll.id);
      await base44.entities.EventPoll.update(poll.id, { status: newStatus });
      toast.success(newStatus === "ended" ? "Poll ended successfully." : "Poll activated successfully.");
      setConfirmEndPoll(null);
      onRefresh();
    } catch (error) {
      toast.error(error.message || "Failed to update poll status");
    } finally {
      setUpdatingPollId(null);
    }
  };

  if (selected) return (
    <AdminPollDetail poll={selected} onBack={() => { setSelected(null); onRefresh(); }} STATUS_BADGE={STATUS_BADGE} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-xl flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" /> ALL POLLS
          <span className="font-mono text-sm text-muted-foreground font-normal">({polls.length})</span>
        </h2>
        <Button onClick={onCreatePoll} className="gap-2 font-display font-bold bg-accent hover:bg-accent/90">
          <BarChart3 className="w-4 h-4" /> New Poll
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search question, event..." className="pl-9 bg-card border-border/50" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "upcoming", "active", "ended"].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                statusFilter === s ? "bg-accent text-accent-foreground border-accent" : "bg-secondary border-border/50 text-muted-foreground hover:border-accent/40"
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
                {["Type", "Event", "Poll Question", "Votes", "End Date", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No polls found</td></tr>
              )}
              {paginated.map(poll => (
                 <tr key={poll.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="p-3">
                    {poll.event_id ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent whitespace-nowrap">
                        <Link2 className="w-2.5 h-2.5" /> Event
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary whitespace-nowrap">
                        <BarChart3 className="w-2.5 h-2.5" /> Standalone
                      </span>
                    )}
                  </td>
                   <td className="p-3 text-xs truncate max-w-[120px]">{poll.event_title || eventMap[poll.event_id] || "—"}</td>
                  <td className="p-3 text-xs max-w-[200px]">
                    <p className="font-medium truncate">{poll.question}</p>
                  </td>
                  <td className="p-3 font-mono text-xs">{poll.total_votes || 0}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {poll.end_datetime ? format(new Date(poll.end_datetime), "MMM dd, yyyy") : "—"}
                  </td>
                  <td className="p-3">
                    {(() => { const s = computeStatus(poll); return (
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[s] || STATUS_BADGE.upcoming}`}>
                        {s}
                      </span>
                    ); })()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap items-center">
                      <button onClick={() => copyLink(poll.id)} title="Copy share link"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        {copiedId === poll.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditPoll(poll)} title="Edit Poll"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setSelected(poll)} title="View Results"
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {computeStatus(poll) !== "ended" && (
                        <button 
                          onClick={() => {
                            if (computeStatus(poll) === "active") {
                              setConfirmEndPoll(poll);
                            } else {
                              handleStatusChange(poll, "active");
                            }
                          }}
                          disabled={updatingPollId === poll.id}
                          className="px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updatingPollId === poll.id ? (
                            <>Updating...</>
                          ) : computeStatus(poll) === "active" ? (
                            <><Stop className="w-3 h-3" /> End Poll</>
                          ) : (
                            <><Play className="w-3 h-3" /> Activate</>
                          )}
                        </button>
                      )}
                      <button onClick={() => setConfirmDelete(poll)} title="Delete"
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
      {editPoll && (
        <AdminEditPollModal
          poll={editPoll}
          events={events}
          onClose={() => setEditPoll(null)}
          onSaved={() => { setEditPoll(null); onRefresh(); }}
        />
      )}

      {/* End Poll Confirmation */}
      <Dialog open={!!confirmEndPoll} onOpenChange={() => setConfirmEndPoll(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">End this poll?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will stop new responses. Existing poll results will remain available.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmEndPoll(null)}>Cancel</Button>
            <Button onClick={() => handleStatusChange(confirmEndPoll, "ended")} disabled={updatingPollId === confirmEndPoll?.id}>
              {updatingPollId === confirmEndPoll?.id ? "Ending..." : "End Poll"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Delete Poll?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this poll. This cannot be undone.</p>
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