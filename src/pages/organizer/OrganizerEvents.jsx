import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, Eye, Settings2, PencilLine, Trash2, Globe, EyeOff, RotateCcw, FileText, BarChart3, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { isVideoUrl } from "@/utils/mediaHelper";
import { isEventPast } from "@/utils/eventUtils";

const TABS = [
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "past", label: "Past" },
];

export default function OrganizerEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("live");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const adminUser = user?.role === "admin";
      setIsAdmin(adminUser);

      // Regular organizer events
      const evs = await base44.entities.Event.filter({ organizer_id: user.id }, "-created_date", 200);

      if (adminUser) {
        // Also load events assigned to the admin workspace organizer name
        const adminEvs = await base44.entities.Event.filter(
          { organizer_name: "Reizor Admin Events" }, "-created_date", 200
        ).catch(() => []);
        // Merge, deduplicate by id
        const merged = [...evs];
        for (const ae of adminEvs) {
          if (!merged.find(e => e.id === ae.id)) merged.push(ae);
        }
        setEvents(merged.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      } else {
        setEvents(evs);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Tab filtering ──
  const now = new Date();
  const liveEvents = events.filter(e => {
    // Must be published (or sold_out) and not yet ended
    if (e.status !== "published" && e.status !== "sold_out") return false;
    return !isEventPast(e);
  });
  const draftEvents = events.filter(e => e.status === "draft");
  const pastEvents = events.filter(e => {
    // Events that ended their time window (published/sold_out/cancelled/completed and date passed)
    if (e.status === "draft") return false;
    return isEventPast(e);
  });

  const activeEvents = tab === "live" ? liveEvents : tab === "draft" ? draftEvents : pastEvents;

  // ── Actions ──
  const publishEvent = async (event) => {
    await base44.entities.Event.update(event.id, { status: "published", deactivated: false });
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: "published", deactivated: false } : e)));
    toast.success("Event published!");
  };

  const deactivateEvent = async (event) => {
    await base44.entities.Event.update(event.id, { status: "draft", deactivated: true });
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: "draft", deactivated: true } : e)));
    toast.success("Event deactivated — moved to Drafts");
  };

  const reactivateEvent = async (event) => {
    await base44.entities.Event.update(event.id, { status: "published", deactivated: false });
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: "published", deactivated: false } : e)));
    toast.success("Event reactivated!");
  };

  const deleteDraft = async () => {
    if (!deleteTarget) return;
    await base44.entities.Event.delete(deleteTarget.id);
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
    toast.success("Draft deleted");
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mobile-bottom-nav-spacing">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">MY EVENTS</h1>
        <Link to="/organizer/create" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto glow-lime font-display font-bold gap-2">
            <CalendarPlus className="w-4 h-4" /> New Event
          </Button>
        </Link>
      </div>

      {/* Tabs: Live / Draft / Past */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border/40">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-display font-bold transition-all ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.key === "live" && liveEvents.length > 0 && <span className="mr-1">{liveEvents.length} </span>}
            {t.key === "draft" && draftEvents.length > 0 && <span className="mr-1">{draftEvents.length} </span>}
            {t.key === "past" && pastEvents.length > 0 && <span className="mr-1">{pastEvents.length} </span>}
            {t.label}
          </button>
        ))}
      </div>

      {activeEvents.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-border/50">
          {tab === "live" ? (
            <>
              <CalendarPlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1 font-display font-bold">No live events</p>
              <p className="text-xs text-muted-foreground mb-4 font-mono">Create and publish an event to see it here</p>
            </>
          ) : tab === "draft" ? (
            <>
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1 font-display font-bold">No saved drafts</p>
              <p className="text-xs text-muted-foreground mb-4 font-mono">Use "Save Draft" when creating an event to save your progress here</p>
            </>
          ) : (
            <>
              <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-1 font-display font-bold">No past events</p>
              <p className="text-xs text-muted-foreground mb-4 font-mono">Completed events will appear here for analytics</p>
            </>
          )}

        </div>
      ) : (
        <div className="space-y-4">
          {activeEvents.map((event) => (
            <div key={event.id} className="flex flex-col gap-4 p-4 sm:p-5 bg-card rounded-xl border border-border/60">
              {/* Top row: thumbnail + info */}
              <div className="flex items-start gap-4">
                {event.cover_image && (
                  isVideoUrl(event.cover_image) ? (
                    <video
                      src={event.cover_image}
                      autoPlay muted loop playsInline
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0 bg-black"
                    />
                  ) : (
                    <img src={event.cover_image} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0" />
                  )
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h3 className="font-display font-bold text-base sm:text-lg leading-snug">{event.title}</h3>
                      {event.organizer_name === "Reizor Admin Events" && (
                        <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/10 shrink-0">
                          <Download className="w-2.5 h-2.5 inline mr-0.5" />Imported
                        </span>
                      )}
                    </div>
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded border shrink-0 ${
                      tab === "live" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                      tab === "draft" && event.deactivated ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" :
                      tab === "draft" ? "text-muted-foreground bg-muted border-border/50" :
                      "text-muted-foreground bg-muted/60 border-border/50"
                    }`}>
                      {tab === "live" ? "LIVE" : tab === "draft" && event.deactivated ? "DEACTIVATED" : tab === "draft" ? "DRAFT" : "PAST"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <span className="font-mono text-sm text-foreground/80 font-medium">
                      {event.date ? format(new Date(event.date), "MMM dd, yyyy") : "No date"}
                    </span>
                    {event.end_date && (
                      <span className="font-mono text-sm text-muted-foreground">
                        – {format(new Date(event.end_date), "MMM dd, yyyy")}
                      </span>
                    )}
                    {event.city && (
                      <span className="font-mono text-sm text-muted-foreground">{event.city}</span>
                    )}
                  </div>
                  <p className="font-mono text-sm font-semibold text-foreground/70 mt-1">
                    {event.tickets_sold || 0} sold · {event.total_capacity || "∞"} cap
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {tab === "draft" && event.deactivated ? (
                  /* Deactivated event in Drafts */
                  <>
                    <button
                      onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-primary border border-primary text-white"
                    >
                      <PencilLine className="w-3.5 h-3.5 shrink-0" /> Edit
                    </button>
                    <button
                      onClick={() => reactivateEvent(event)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-green-400/10 border border-green-400/50 text-green-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Reactivate Event
                    </button>
                    <button
                      onClick={() => setDeleteTarget(event)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-destructive/10 border border-destructive/30 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                    </button>
                  </>
                ) : tab === "draft" ? (
                  /* Fresh draft — never published */
                  <>
                    <button
                      onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-primary border border-primary text-white"
                    >
                      <PencilLine className="w-3.5 h-3.5 shrink-0" /> Continue Editing
                    </button>
                    <button
                      onClick={() => publishEvent(event)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-green-400/10 border border-green-400/50 text-green-400"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" /> Publish
                    </button>
                    <button
                      onClick={() => setDeleteTarget(event)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-destructive/10 border border-destructive/30 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete
                    </button>
                  </>
                ) : tab === "past" ? (
                  /* Past events — View, Analytics, Reuse */
                  <>
                    <Link to={`/events/${event.id}`} className="contents">
                      <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-accent border border-accent text-white">
                        <Eye className="w-3.5 h-3.5 shrink-0" /> View
                      </button>
                    </Link>
                    <button
                      onClick={() => navigate(`/organizer/events/${event.id}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-accent border border-accent text-white"
                    >
                      <BarChart3 className="w-3.5 h-3.5 shrink-0" /> Analytics
                    </button>
                    <button
                      onClick={() => navigate(`/organizer/create?clone_from=${event.id}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-primary border border-primary text-white col-span-2 sm:col-span-1"
                    >
                      <Copy className="w-3.5 h-3.5 shrink-0" /> Reuse Event
                    </button>
                  </>
                ) : (
                  /* Live events */
                  <>
                    <Link to={`/events/${event.id}`} className="contents">
                      <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-accent border border-accent text-white">
                        <Eye className="w-3.5 h-3.5 shrink-0" /> View
                      </button>
                    </Link>
                    <button
                      onClick={() => navigate(`/organizer/events/${event.id}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-accent border border-accent text-white"
                    >
                      <Settings2 className="w-3.5 h-3.5 shrink-0" /> Manage
                    </button>
                    <button
                      onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-primary border border-primary text-white"
                    >
                      <PencilLine className="w-3.5 h-3.5 shrink-0" /> Edit
                    </button>
                    <button
                      onClick={() => deactivateEvent(event)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono font-bold bg-yellow-400/10 border border-yellow-400/50 text-yellow-400"
                    >
                      <EyeOff className="w-3.5 h-3.5 shrink-0" /> Deactivate
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete Draft"
        description={`Are you sure you want to delete "${deleteTarget?.title || 'this draft'}"? This action cannot be undone.`}
        confirmLabel="Delete Draft"
        confirmVariant="destructive"
        onConfirm={deleteDraft}
      />
    </div>
  );
}