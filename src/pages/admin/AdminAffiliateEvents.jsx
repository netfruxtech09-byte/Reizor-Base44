import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink, RefreshCw, TrendingUp, MousePointer, DollarSign, X, ChevronRight, Settings2, ArrowRight } from "lucide-react";
import { getRelativeTime } from "@/utils/getRelativeTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { isEventPast } from "@/utils/eventUtils";

const SOURCES = ["ticketmaster", "eventbrite", "seatgeek", "viagogo", "stubhub", "other"];

export default function AdminAffiliateEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [tab, setTab] = useState("earnings"); // events | earnings | discover
  const [discovered, setDiscovered] = useState([]);
  const [discoverQuery, setDiscoverQuery] = useState({ query: "music concerts", city: "", genre: "" });
  const [importingIds, setImportingIds] = useState(new Set()); // tracks which events are being imported
  const [importedKeys, setImportedKeys] = useState(new Set()); // tracks already-imported external_ids/titles this session
  const [convertingIds, setConvertingIds] = useState(new Set()); // tracks ExternalEvent IDs being converted to Reizor
  const [managingIds, setManagingIds] = useState(new Set()); // tracks "Manage in Dashboard" in-flight checks

  useEffect(() => {
    Promise.all([
      base44.entities.ExternalEvent.list("-created_date", 200),
      base44.entities.AffiliateEarning.list("-created_date", 200),
    ]).then(async ([evs, earns]) => {
      // A promoted event that was converted to a native Reizor event must disappear
      // the moment that native event is cancelled or has ended — check current status.
      const linkedIds = [...new Set(evs.filter(e => e.managed_mode === "reizor" && e.linked_event_id).map(e => e.linked_event_id))];
      const statusMap = {};
      if (linkedIds.length) {
        await Promise.all(linkedIds.map(async (id) => {
          const found = await base44.entities.Event.filter({ id }, null, 1).catch(() => []);
          if (found[0]) statusMap[id] = found[0];
        }));
      }
      const visibleEvents = evs.filter(e => {
        if (e.managed_mode === "reizor" && e.linked_event_id) {
          const linked = statusMap[e.linked_event_id];
          if (linked && (linked.status === "cancelled" || isEventPast(linked))) return false;
        }
        return true;
      });
      setEvents(visibleEvents);
      setEarnings(earns);
      setLoading(false);
    });
  }, []);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await base44.functions.invoke("discoverAffiliateEvents", discoverQuery);
      const foundEvents = res.data?.events || [];
      setDiscovered(foundEvents);
      if (foundEvents.length === 0) {
        toast.info("No events found. Try a different query.");
      } else {
        toast.success(`Found ${foundEvents.length} events via ${res.data?.source || "search"}`);
      }
    } catch (err) {
      toast.error("Discovery failed: " + (err.message || "Unknown error"));
    } finally {
      setDiscovering(false);
    }
  };

  const getEventKey = (ev) => ev.external_id || ev.title;

  const importEvent = async (ev, idx) => {
    const key = getEventKey(ev);
    // Duplicate check against DB records and already-imported this session
    const existsInDb = events.find(e =>
      (ev.external_id && e.external_id === ev.external_id) || e.title === ev.title
    );
    if (existsInDb || importedKeys.has(key)) {
      toast.info("This event has already been imported.");
      return;
    }
    if (importingIds.has(key)) return; // prevent double-click

    setImportingIds(prev => new Set(prev).add(key));
    try {
      const payload = {
        title: ev.title,
        date: ev.date || new Date().toISOString(),
        affiliate_url: ev.affiliate_url || "#",
        affiliate_source: ev.affiliate_source || "other",
        description: ev.description || "",
        venue_name: ev.venue_name || "",
        city: ev.city || "",
        country: ev.country || "",
        genre: ev.genre || "",
        cover_image: ev.cover_image || "",
        artists: ev.artists || [],
        external_id: ev.external_id || "",
        min_price: ev.min_price || null,
        max_price: ev.max_price || null,
        commission_rate: ev.commission_rate || 5,
        status: "active",
      };
      const created = await base44.entities.ExternalEvent.create(payload);
      setEvents(prev => [created, ...prev]);
      setImportedKeys(prev => new Set(prev).add(key));
      toast.success("Affiliate event imported successfully.");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Unknown error";
      toast.error("Import failed: " + msg);
    } finally {
      setImportingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const importAll = async () => {
    let count = 0;
    for (const ev of discovered) {
      const key = getEventKey(ev);
      const existsInDb = events.find(e =>
        (ev.external_id && e.external_id === ev.external_id) || e.title === ev.title
      );
      if (existsInDb || importedKeys.has(key)) continue;
      try {
        const payload = {
          title: ev.title,
          date: ev.date || new Date().toISOString(),
          affiliate_url: ev.affiliate_url || "#",
          affiliate_source: ev.affiliate_source || "other",
          description: ev.description || "",
          venue_name: ev.venue_name || "",
          city: ev.city || "",
          country: ev.country || "",
          genre: ev.genre || "",
          cover_image: ev.cover_image || "",
          artists: ev.artists || [],
          external_id: ev.external_id || "",
          min_price: ev.min_price || null,
          max_price: ev.max_price || null,
          commission_rate: ev.commission_rate || 5,
          status: "active",
        };
        const created = await base44.entities.ExternalEvent.create(payload);
        setEvents(prev => [created, ...prev]);
        setImportedKeys(prev => new Set(prev).add(key));
        count++;
      } catch {}
    }
    toast.success(`Imported ${count} event${count !== 1 ? "s" : ""} successfully.`);
  };

  const handleManageInDashboard = async (ev) => {
    if (managingIds.has(ev.id)) return; // prevent double-click
    const linkedId = ev.linked_event_id;
    if (!linkedId) {
      toast.error("This event has been deleted from our platform.");
      return;
    }
    setManagingIds(prev => new Set(prev).add(ev.id));
    try {
      const linked = await base44.entities.Event.get(linkedId).catch(() => null);
      if (!linked) {
        toast.error("This event has been deleted from our platform.");
        return;
      }
      navigate(`/organizer/events/${linkedId}`);
    } finally {
      setManagingIds(prev => { const s = new Set(prev); s.delete(ev.id); return s; });
    }
  };

  const convertToReizor = async (ev) => {
    if (convertingIds.has(ev.id)) return;
    // Already converted
    if (ev.managed_mode === "reizor" && ev.linked_event_id) {
      navigate(`/organizer/events/${ev.linked_event_id}/edit`);
      return;
    }
    setConvertingIds(prev => new Set(prev).add(ev.id));
    try {
      const res = await base44.functions.invoke("importEventToReizor", { external_event_id: ev.id });
      if (res.data?.success) {
        const linkedId = res.data.linked_event_id;
        setEvents(prev => prev.map(e => e.id === ev.id
          ? { ...e, managed_mode: "reizor", linked_event_id: linkedId }
          : e
        ));
        if (res.data.already_converted) {
          toast.info("Already converted — opening event editor.");
        } else {
          toast.success("Event imported as Draft Reizor event!");
        }
        navigate(`/organizer/events/${linkedId}`);
      } else {
        toast.error(res.data?.error || "Conversion failed");
      }
    } catch (err) {
      toast.error("Conversion failed: " + (err.message || "Unknown error"));
    } finally {
      setConvertingIds(prev => { const s = new Set(prev); s.delete(ev.id); return s; });
    }
  };

  const deleteEvent = async (id) => {
    await base44.entities.ExternalEvent.delete(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    toast.success("Event removed from tracking");
  };

  const addManualEarning = async (eventId, eventTitle, source) => {
    const amount = parseFloat(prompt("Enter confirmed commission amount ($):") || "0");
    if (!amount) return;
    const created = await base44.entities.AffiliateEarning.create({
      external_event_id: eventId,
      event_title: eventTitle,
      affiliate_source: source,
      action: "manual_entry",
      amount,
      status: "confirmed",
    });
    setEarnings(prev => [created, ...prev]);
    await base44.entities.ExternalEvent.update(eventId, {
      confirmed_earnings: (events.find(e => e.id === eventId)?.confirmed_earnings || 0) + amount
    });
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, confirmed_earnings: (e.confirmed_earnings || 0) + amount } : e));
    toast.success(`$${amount} earning recorded!`);
  };

  const totalClicks = events.reduce((s, e) => s + (e.click_count || 0), 0);
  const totalConfirmed = events.reduce((s, e) => s + (e.confirmed_earnings || 0), 0);
  const totalEstimated = events.reduce((s, e) => s + (e.estimated_earnings || 0), 0);

  // Affiliate earnings analytics
  const earningsBySource = SOURCES.map(source => {
    const sourceEarnings = earnings.filter(e => e.affiliate_source === source);
    const totalAmount = sourceEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const confirmedAmount = sourceEarnings.filter(e => e.status === "confirmed").reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingAmount = sourceEarnings.filter(e => e.status === "pending").reduce((sum, e) => sum + (e.amount || 0), 0);
    const paidAmount = sourceEarnings.filter(e => e.status === "paid").reduce((sum, e) => sum + (e.amount || 0), 0);
    const clicks = sourceEarnings.length;
    return { source, totalAmount, confirmedAmount, pendingAmount, paidAmount, clicks, earnings: sourceEarnings };
  }).filter(s => s.clicks > 0 || s.totalAmount > 0);

  const grandTotalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grandTotalConfirmed = earnings.filter(e => e.status === "confirmed").reduce((sum, e) => sum + (e.amount || 0), 0);
  const grandTotalPaid = earnings.filter(e => e.status === "paid").reduce((sum, e) => sum + (e.amount || 0), 0);
  const grandTotalPending = earnings.filter(e => e.status === "pending").reduce((sum, e) => sum + (e.amount || 0), 0);

  const [cardModal, setCardModal] = useState(null); // { title, records }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">AFFILIATE PROGRAM</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage affiliate links and track earnings from partner events</p>
      </div>



      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {["earnings", "events", "discover"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-display font-bold capitalize border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "events" ? "Promoted Events" : t}
          </button>
        ))}
      </div>

      {/* EVENTS TAB - Events they're promoting */}
      {tab === "events" && (
        <div className="space-y-3">
          {events.length === 0 && (
            <div className="text-center py-12 bg-card rounded-xl border border-border/50 text-muted-foreground text-sm">
              No events promoted yet. Use "Discover" to find and add affiliate events.
            </div>
          )}
          {events.map(ev => (
            <div key={ev.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-bold">{ev.title}</p>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">{ev.affiliate_source}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ev.city} · {ev.date ? format(new Date(ev.date), "MMM dd, yyyy") : "TBA"}
                  {ev.min_price ? ` · From $${ev.min_price}` : ""}
                  {` · ${ev.commission_rate || 5}% commission`}
                </p>
                <div className="flex gap-4 mt-2 text-xs font-mono">
                  <span className="text-muted-foreground"><MousePointer className="w-3 h-3 inline mr-1" />{ev.click_count || 0} clicks</span>
                  <span className="text-green-400 font-bold"><DollarSign className="w-3 h-3 inline mr-1" />${(ev.confirmed_earnings || 0).toFixed(2)} earned</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {ev.managed_mode === "reizor" ? (
                  <button
                    onClick={() => handleManageInDashboard(ev)}
                    disabled={managingIds.has(ev.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-green-400/10 border border-green-400/30 text-green-400 disabled:opacity-50"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {managingIds.has(ev.id) ? "Opening..." : ev.linked_event_id ? "Manage in Dashboard" : "Event Unavailable"}
                  </button>
                ) : (
                  <button
                    onClick={() => convertToReizor(ev)}
                    disabled={convertingIds.has(ev.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-primary/10 border border-primary/30 text-primary disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    {convertingIds.has(ev.id) ? "Importing..." : "Manage on Reizor"}
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      base44.functions.invoke("trackAffiliateClick", {
                        external_event_id: ev.id,
                        event_title: ev.title,
                        affiliate_source: ev.affiliate_source,
                        commission_rate: ev.commission_rate || 5,
                      }).then(() => {
                        setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, click_count: (e.click_count || 0) + 1 } : e));
                      }).catch(() => {});
                      window.open(ev.affiliate_url, "_blank", "noopener,noreferrer");
                    }}
                    title="View affiliate link"
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors" title="Remove from tracking">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DISCOVER TAB */}
      {tab === "discover" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <h3 className="font-display font-bold">AI-Powered Event Discovery</h3>
            <p className="text-xs text-muted-foreground">Find real events from affiliate platforms using AI web search. Add a Ticketmaster API key in dashboard settings for live API data.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Search Query</Label>
                <Input value={discoverQuery.query} onChange={e => setDiscoverQuery(p => ({ ...p, query: e.target.value }))}
                  placeholder="music concerts festivals" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">City (optional)</Label>
                <Input value={discoverQuery.city} onChange={e => setDiscoverQuery(p => ({ ...p, city: e.target.value }))}
                  placeholder="New York" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Genre (optional)</Label>
                <Input value={discoverQuery.genre} onChange={e => setDiscoverQuery(p => ({ ...p, genre: e.target.value }))}
                  placeholder="techno, pop, hip-hop" className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>
            <Button onClick={handleDiscover} disabled={discovering} className="glow-lime font-display font-bold gap-2">
              <RefreshCw className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`} />
              {discovering ? "Discovering..." : "Discover Events"}
            </Button>
          </div>

          {discovered.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold">{discovered.length} events found</p>
                <Button onClick={importAll} size="sm" variant="outline" className="font-display font-bold gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Import All
                </Button>
              </div>
              {discovered.map((ev, i) => {
                const key = getEventKey(ev);
                const isImporting = importingIds.has(key);
                const isImported = importedKeys.has(key) || !!events.find(e =>
                  (ev.external_id && e.external_id === ev.external_id) || e.title === ev.title
                );
                return (
                  <div key={i} className="p-4 rounded-xl bg-card border border-border/50 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold">{ev.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ev.city} · {ev.date ? format(new Date(ev.date), "MMM dd, yyyy") : "TBA"} · <span className="text-primary">{ev.affiliate_source}</span></p>
                      {ev.artists?.length > 0 && <p className="text-xs text-muted-foreground">{ev.artists.join(", ")}</p>}
                      {ev.min_price && <p className="text-xs text-green-400 mt-0.5">From ${ev.min_price} · {ev.commission_rate}% commission</p>}
                    </div>
                    {isImported ? (
                      <span className="text-xs font-mono font-bold text-green-400 bg-green-400/10 px-3 py-1.5 rounded-md shrink-0">✓ Imported</span>
                    ) : (
                      <Button
                        onClick={() => importEvent(ev, i)}
                        size="sm"
                        variant="outline"
                        disabled={isImporting}
                        className="font-display font-bold shrink-0"
                      >
                        {isImporting ? "Importing..." : "Import"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EARNINGS TAB */}
       {tab === "earnings" && (
        <div className="space-y-6">
          {/* Total earnings cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Earnings", value: grandTotalEarnings, color: "text-primary", border: "border-primary/30", bg: "bg-primary/10", records: earnings },
              { label: "Confirmed",      value: grandTotalConfirmed, color: "text-green-400", border: "border-green-400/30", bg: "bg-green-400/10", records: earnings.filter(e => e.status === "confirmed") },
              { label: "Pending",        value: grandTotalPending,  color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/10", records: earnings.filter(e => e.status === "pending") },
              { label: "Paid Out",       value: grandTotalPaid,     color: "text-accent",     border: "border-accent/30",       bg: "bg-accent/10",       records: earnings.filter(e => e.status === "paid") },
            ].map(card => (
              <button
                key={card.label}
                onClick={() => setCardModal({ title: card.label, records: card.records })}
                className={`p-4 rounded-xl ${card.bg} border ${card.border} text-left hover:opacity-80 active:scale-95 transition-all cursor-pointer group`}
              >
                <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{card.label}</p>
                <p className={`font-display font-black text-2xl ${card.color} mt-1`}>${card.value.toFixed(2)}</p>
                <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">{card.records.length} record{card.records.length !== 1 ? "s" : ""} · tap to view</p>
              </button>
            ))}
          </div>

          {earnings.length === 0 && (
            <div className="text-center py-12 bg-card rounded-xl border border-border/50 text-muted-foreground text-sm">
              No affiliate earnings recorded yet.
            </div>
          )}

          {/* Earnings by affiliate source */}
          {earningsBySource.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-lg">Earnings by Affiliate Source</h3>
              {earningsBySource.map(({ source, totalAmount, confirmedAmount, pendingAmount, paidAmount, clicks, earnings: sourceEarnings }) => (
                <div key={source} className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-lg capitalize">{source}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{clicks} {clicks === 1 ? "transaction" : "transactions"}</p>
                    </div>
                    <p className="font-display font-black text-3xl text-primary">${totalAmount.toFixed(2)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/20">
                      <p className="text-xs text-muted-foreground mb-1">Confirmed</p>
                      <p className="font-mono font-bold text-green-400">${confirmedAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                      <p className="text-xs text-muted-foreground mb-1">Pending</p>
                      <p className="font-mono font-bold text-yellow-400">${pendingAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground mb-1">Paid</p>
                      <p className="font-mono font-bold text-accent">${paidAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Source earnings list */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {sourceEarnings.map(earn => (
                      <div key={earn.id} className="flex items-center justify-between text-xs">
                        <div className="flex-1">
                          <p className="text-muted-foreground">{earn.event_title} · {earn.action}</p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono">{format(new Date(earn.created_date), "MMM dd, yyyy")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-foreground">${earn.amount.toFixed(2)}</p>
                          <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded ml-2 inline-block ${
                            earn.status === "confirmed" ? "text-green-400 bg-green-400/10" :
                            earn.status === "paid" ? "text-accent bg-accent/10" :
                            "text-yellow-400 bg-yellow-400/10"
                          }`}>{earn.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Affiliate card drill-down modal */}
      {cardModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCardModal(null)}>
          <div
            className="w-full sm:max-w-xl bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "88dvh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <div>
                <h2 className="font-display font-bold text-base">{cardModal.title}</h2>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{cardModal.records.length} record{cardModal.records.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setCardModal(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4">
              {cardModal.records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No records found.</p>
              ) : (
                <div className="space-y-2">
                  {cardModal.records.map(earn => (
                    <div key={earn.id} className="p-3 rounded-xl bg-background border border-border/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{earn.event_title || "—"}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {earn.affiliate_source && (
                              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{earn.affiliate_source}</span>
                            )}
                            {earn.action && (
                              <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{earn.action.replace(/_/g, " ")}</span>
                            )}
                            {earn.click_user_name && (
                              <span className="text-[10px] font-mono text-muted-foreground">{earn.click_user_name}</span>
                            )}
                            {earn.click_user_email && (
                              <span className="text-[10px] font-mono text-muted-foreground/70">{earn.click_user_email}</span>
                            )}
                            {earn.created_date && (
                              <span className="text-[10px] font-mono text-muted-foreground/60">{getRelativeTime(earn.created_date)}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-sm text-foreground">${(earn.amount || 0).toFixed(2)}</p>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            earn.status === "confirmed" ? "bg-green-400/15 text-green-400" :
                            earn.status === "paid" ? "bg-accent/15 text-accent" :
                            earn.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                            "bg-yellow-400/15 text-yellow-400"
                          }`}>{earn.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-border/30 flex justify-end">
              <button onClick={() => setCardModal(null)} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}