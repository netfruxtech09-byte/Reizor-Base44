import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Eye, Trash2, Search, CheckCircle2, XCircle, Rocket,
  Calendar, MapPin, Users, Ticket, BarChart2, X, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { getDisplayStatus, DISPLAY_STATUS_CONFIG, isEventPast, isActivePublishedEvent } from "@/utils/eventUtils";

const FILTERS = ["all", "published", "draft", "pending", "cancelled", "past"];

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null); // event id or "bulk"
  const [confirmCancel, setConfirmCancel] = useState(null); // event id to cancel
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    base44.entities.Event.list("-created_date", 500).then((e) => {
      setEvents(e);
      setLoading(false);
    });
  }, []);

  // Stats — uses centralized Published Events definition
  const stats = useMemo(() => {
    const active = events.filter(e => !isEventPast(e) && e.status !== "cancelled");
    const past   = events.filter(e => isEventPast(e) && e.status !== "cancelled");
    return {
      total:     active.length,
      published: events.filter(isActivePublishedEvent).length,
      pending:   active.filter(e => e.status === "pending").length,
      draft:     active.filter(e => e.status === "draft").length,
      cancelled: events.filter(e => e.status === "cancelled").length,
      past:      past.length,
    };
  }, [events]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = events.filter(e => {
      const displayStatus = getDisplayStatus(e);
      let matchFilter;
      if (filter === "all") {
        // "all" = active events only (not past, not cancelled)
        matchFilter = displayStatus !== "past" && e.status !== "cancelled";
      } else if (filter === "past") {
        matchFilter = displayStatus === "past";
      } else if (filter === "published") {
        // Use the centralized Published Events definition
        matchFilter = isActivePublishedEvent(e);
      } else {
        matchFilter = e.status === filter && displayStatus !== "past";
      }
      const matchSearch = !q ||
        (e.title || "").toLowerCase().includes(q) ||
        (e.organizer_name || "").toLowerCase().includes(q) ||
        (e.city || "").toLowerCase().includes(q) ||
        (e.venue_name || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
    if (filter === "all") {
      return [...list].sort((a, b) => {
        const aPublished = isActivePublishedEvent(a) ? 0 : 1;
        const bPublished = isActivePublishedEvent(b) ? 0 : 1;
        return aPublished - bPublished;
      });
    }
    return list;
  }, [events, filter, search]);

  const updateStatus = async (eventId, status) => {
    setActionLoading(eventId + status);
    await base44.functions.invoke('adminActions', { action: 'updateEvent', event_id: eventId, data: { status } });
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status } : e));
    toast.success("Event status updated");
    setActionLoading(null);
  };

  const doDelete = async (eventId) => {
    setActionLoading(eventId);
    await base44.functions.invoke('adminActions', { action: 'deleteEvent', event_id: eventId });
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setSelected(prev => { const s = new Set(prev); s.delete(eventId); return s; });
    toast.success("Event deleted");
    setConfirmDelete(null);
    setActionLoading(null);
  };

  const doBulkDelete = async () => {
    setActionLoading("bulk");
    for (const id of selected) {
      await base44.functions.invoke('adminActions', { action: 'deleteEvent', event_id: id });
    }
    setEvents(prev => prev.filter(e => !selected.has(e.id)));
    toast.success(`${selected.size} event(s) deleted`);
    setSelected(new Set());
    setConfirmDelete(null);
    setActionLoading(null);
  };

  const doBulkStatus = async (status) => {
    setActionLoading("bulk-status");
    for (const id of selected) {
      await base44.functions.invoke('adminActions', { action: 'updateEvent', event_id: id, data: { status } });
    }
    setEvents(prev => prev.map(e => selected.has(e.id) ? { ...e, status } : e));
    toast.success(`${selected.size} event(s) updated`);
    setSelected(new Set());
    setActionLoading(null);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">ALL EVENTS</h1>
        <p className="text-sm text-muted-foreground mt-1">{stats.total} active · {stats.past} past · {events.length} total</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Active",    filterKey: "all",       value: stats.total,     color: "text-foreground" },
          { label: "Published", filterKey: "published", value: stats.published, color: "text-green-400" },
          { label: "Pending",   filterKey: "pending",   value: stats.pending,   color: "text-yellow-400" },
          { label: "Draft",     filterKey: "draft",     value: stats.draft,     color: "text-muted-foreground" },
          { label: "Cancelled", filterKey: "cancelled", value: stats.cancelled, color: "text-destructive" },
          { label: "Past",      filterKey: "past",      value: stats.past,      color: "text-muted-foreground" },
        ].map(s => (
          <button key={s.label}
            onClick={() => setFilter(s.filterKey)}
            className={`p-3 rounded-xl bg-card border transition-all text-left hover:border-primary/40 ${
              filter === s.filterKey ? "border-primary/50 bg-primary/5" : "border-border/50"
            }`}>
            <p className="text-xs font-mono text-muted-foreground">{s.label}</p>
            <span className={`font-display font-black text-2xl leading-none tabular-nums ${s.color}`}>{s.value}</span>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by event name, organizer, city, venue..."
            className="pl-9 bg-card border-border/50" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all capitalize ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
          <span className="font-mono text-sm font-bold text-primary">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" onClick={() => doBulkStatus("published")}
              disabled={actionLoading === "bulk-status"}
              className="border-green-400/40 text-green-400 hover:bg-green-400/10 gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Publish All
            </Button>
            <Button size="sm" variant="outline" onClick={() => doBulkStatus("cancelled")}
              disabled={actionLoading === "bulk-status"}
              className="border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 gap-1.5 text-xs">
              <XCircle className="w-3.5 h-3.5" /> Cancel All
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete("bulk")}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5 text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground">
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Select All row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
            className="w-4 h-4 rounded accent-primary cursor-pointer border-2 border-pink-500 bg-pink-500/10" />
          <span className="text-xs font-mono text-muted-foreground">
            {allSelected ? "Deselect all" : `Select all ${filtered.length}`}
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">{filtered.length} shown</span>
        </div>
      )}

      {/* Events List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No events found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => {
            const displayStatus = getDisplayStatus(event);
            const st = DISPLAY_STATUS_CONFIG[displayStatus] || DISPLAY_STATUS_CONFIG.draft;
            const soldPct = event.total_capacity ? Math.min(100, Math.round(((event.tickets_sold || 0) / event.total_capacity) * 100)) : 0;
            const isPast = displayStatus === "past";

            return (
              <div key={event.id}
                className={`rounded-xl bg-card border transition-all ${
                  selected.has(event.id) ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border"
                }`}>
                <div className="flex items-start gap-3 p-4">
                  {/* Checkbox */}
                  <input type="checkbox" checked={selected.has(event.id)} onChange={() => toggleSelect(event.id)}
                    className="mt-1 w-4 h-4 rounded accent-primary cursor-pointer shrink-0 border-2 border-pink-500 bg-pink-500/10" />

                  {/* Cover Image */}
                  {event.cover_image && (
                    <img src={event.cover_image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 hidden sm:block" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-base leading-tight truncate">{event.title}</h3>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                      {event.date && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(event.date), "MMM dd, yyyy")}
                        </span>
                      )}
                      {event.city && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {event.city}
                        </span>
                      )}
                      {event.organizer_name && (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {event.organizer_name}
                        </span>
                      )}
                    </div>

                    {/* Ticket progress */}
                    {event.total_capacity > 0 && (
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 max-w-[160px] h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${soldPct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                          {event.tickets_sold || 0} / {event.total_capacity}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* Conditional status actions */}
                    {event.status === "draft" && (
                      <button
                        onClick={() => updateStatus(event.id, "published")}
                        disabled={actionLoading === event.id + "published"}
                        title="Publish"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                        <Rocket className="w-4 h-4" /> <span className="hidden sm:inline">Publish</span>
                      </button>
                    )}
                    {event.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(event.id, "published")}
                          disabled={actionLoading === event.id + "published"}
                          title="Approve"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                          <CheckCircle2 className="w-4 h-4" /> <span className="hidden sm:inline">Approve</span>
                        </button>
                        <button
                          onClick={() => updateStatus(event.id, "cancelled")}
                          disabled={actionLoading === event.id + "cancelled"}
                          title="Reject"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> <span className="hidden sm:inline">Reject</span>
                        </button>
                      </>
                    )}
                    {event.status === "published" && (
                      <button
                        onClick={() => setConfirmCancel(event.id)}
                        disabled={actionLoading === event.id + "cancelled"}
                        title="Cancel Event"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50">
                        <XCircle className="w-4 h-4" /> <span className="hidden sm:inline">Cancel Event</span>
                      </button>
                    )}

                    {/* Edit */}
                    <Link to={`/organizer/events/${event.id}/edit`} target="_blank">
                      <button title="Edit Event"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-colors">
                        <Pencil className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-mono font-bold">Edit</span>
                      </button>
                    </Link>

                    {/* View */}
                    <Link to={`/events/${event.id}`} target="_blank">
                      <button title="View Event Page"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-mono font-bold">View</span>
                      </button>
                    </Link>

                    {/* Delete */}
                    <button onClick={() => setConfirmDelete(event.id)} title="Delete"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs font-mono font-bold">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="font-display font-bold">Cancel Event</h2>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to cancel "{events.find(e => e.id === confirmCancel)?.title}"?
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This will mark the event as cancelled. Ticket holders will no longer be able to use their tickets.</p>
            <div className="flex gap-3">
              <Button onClick={async () => { await updateStatus(confirmCancel, "cancelled"); setConfirmCancel(null); }}
                disabled={!!actionLoading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                {actionLoading ? "Cancelling..." : "Confirm Cancel"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep Event</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-display font-bold">Confirm Delete</h2>
                <p className="text-sm text-muted-foreground">
                  {confirmDelete === "bulk"
                    ? `Delete ${selected.size} selected event(s)?`
                    : `Delete "${events.find(e => e.id === confirmDelete)?.title}"?`}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button onClick={confirmDelete === "bulk" ? doBulkDelete : () => doDelete(confirmDelete)}
                disabled={!!actionLoading}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {actionLoading ? "Deleting..." : "Delete"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}