import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Search, RefreshCw, Plus, Copy, Check, Edit2, Trash2, Power, QrCode, Download, ExternalLink, ShieldAlert, Trophy, Share2, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import TopSellersTab from "@/components/organizer/TopSellersTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import QRCode from "qrcode";

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-HTTPS or unsupported browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    return true;
  } catch {
    return false;
  }
}

const BLANK = {
  promoter_name: "", promoter_email: "", promoter_phone: "",
  tracking_code: "", max_tickets: "", max_tables: "",
  custom_ticket_price: "", custom_table_price: "",
  commission_type: "none", commission_value: "",
  start_date: "", expiry_date: "", status: "active",
};

export default function TicketSellers() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...BLANK, tracking_code: generateCode() });
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [qrModal, setQrModal] = useState(null); // { id, url, name }
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [createdLink, setCreatedLink] = useState(null); // show after creation
  const [formErrors, setFormErrors] = useState({}); // field-level errors
  const [activeTab, setActiveTab] = useState("sellers"); // "sellers" | "top"
  const [expandedSellerId, setExpandedSellerId] = useState(null); // sales drill-down
  const [sellerOrders, setSellerOrders] = useState({}); // { [sellerId]: orders[] }
  const [loadingOrders, setLoadingOrders] = useState({});

  // Load user + events
  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const isAdmin = u?.role === "admin";
      // Organizers: fetch by organizer_id (user.id) OR by created_by (user.email) to cover both cases
      const evs = isAdmin
        ? await base44.entities.Event.filter({ status: "published" }, "-date", 200).catch(() => [])
        : await Promise.all([
            base44.entities.Event.filter({ organizer_id: u.id, status: "published" }, "-date", 200).catch(() => []),
            base44.entities.Event.filter({ created_by: u.email, status: "published" }, "-date", 200).catch(() => []),
          ]).then(([byId, byEmail]) => {
            const seen = new Set();
            return [...byId, ...byEmail].filter(e => seen.has(e.id) ? false : seen.add(e.id));
          });
      setEvents(evs);
    }).catch(() => {});
  }, []);

  // Load seller links
  const load = async () => {
    if (!user) return;
    setLoading(true);
    const isAdmin = user?.role === "admin";
    const data = isAdmin
      ? await base44.entities.SellerLink.list("-created_date", 500).catch(() => [])
      : await base44.entities.SellerLink.filter({ organizer_id: user.id }, "-created_date", 500).catch(() => []);
    setLinks(data);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Filtered links
  const filtered = links.filter(l => {
    const matchEvent = selectedEvent === "all" || l.event_id === selectedEvent;
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchSearch = !search || l.promoter_name?.toLowerCase().includes(search.toLowerCase()) || l.promoter_email?.toLowerCase().includes(search.toLowerCase());
    return matchEvent && matchStatus && matchSearch;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK, tracking_code: generateCode() });
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (link) => {
    setEditing(link);
    setFormErrors({});
    setForm({
      promoter_name: link.promoter_name || "",
      promoter_email: link.promoter_email || "",
      promoter_phone: link.promoter_phone || "",
      tracking_code: link.tracking_code || "",
      max_tickets: link.max_tickets || "",
      max_tables: link.max_tables || "",
      custom_ticket_price: link.custom_ticket_price || "",
      custom_table_price: link.custom_table_price || "",
      commission_type: link.commission_type || "none",
      commission_value: link.commission_value || "",
      start_date: link.start_date ? new Date(link.start_date).toISOString().slice(0, 16) : "",
      expiry_date: link.expiry_date ? new Date(link.expiry_date).toISOString().slice(0, 16) : "",
      status: link.status || "active",
      event_id: link.event_id || "none",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    // Field-level validation
    const errors = {};
    const eventId = editing ? (form.event_id || editing.event_id) : (form.event_id || "");
    if (!form.promoter_name.trim()) errors.promoter_name = "Seller name is required";
    if (!form.tracking_code.trim()) errors.tracking_code = "Tracking code is required";
    if (form.commission_type !== "none" && (!form.commission_value || Number(form.commission_value) <= 0)) {
      errors.commission_value = "Enter a commission value greater than 0";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setFormErrors({});

    // Duplicate tracking code check (only check per event if event is selected)
    const existing = links.find(l => l.tracking_code === form.tracking_code.toUpperCase() && (eventId ? l.event_id === eventId : !l.event_id) && l.id !== editing?.id);
    if (existing) {
      setFormErrors({ tracking_code: "This tracking code is already used for this event" });
      toast.error("Tracking code already in use for this event");
      return;
    }

    setSaving(true);
    try {
      const ev = events.find(e => e.id === eventId);
      const data = {
        event_id: eventId || null,
        event_title: ev?.title || editing?.event_title || "",
        organizer_id: ev?.organizer_id || editing?.organizer_id || user?.id,
        organizer_email: ev?.created_by || editing?.organizer_email || user?.email,
        promoter_name: form.promoter_name.trim(),
        promoter_email: form.promoter_email.trim(),
        promoter_phone: form.promoter_phone.trim(),
        tracking_code: form.tracking_code.toUpperCase(),
        max_tickets: form.max_tickets ? Number(form.max_tickets) : 0,
        max_tables: form.max_tables ? Number(form.max_tables) : 0,
        custom_ticket_price: form.custom_ticket_price ? Number(form.custom_ticket_price) : 0,
        custom_table_price: form.custom_table_price ? Number(form.custom_table_price) : 0,
        commission_type: form.commission_type,
        commission_value: form.commission_value ? Number(form.commission_value) : 0,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
        status: form.status,
      };

      if (editing) {
        await base44.entities.SellerLink.update(editing.id, data);
        toast.success("Ticket seller updated successfully");
        setShowForm(false);
        load();
      } else {
        const created = await base44.entities.SellerLink.create({ ...data, tickets_sold: 0, tables_sold: 0, total_revenue: 0, commission_earned: 0 });
        toast.success(`Seller "${data.promoter_name}" created successfully!`);
        setShowForm(false);
        setCreatedLink({ ...data, id: created.id });
        load();
      }
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("permission denied") || msg.toLowerCase().includes("not authorized")) {
        toast.error("Permission denied — your account does not have the Organizer role. Ask an admin to switch your role.");
      } else {
        toast.error(msg || "Failed to save seller. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link) => {
    if (link.tickets_sold > 0 || link.tables_sold > 0) {
      toast.error("Cannot delete a seller with existing sales. Deactivate it instead.");
      return;
    }
    if (!window.confirm(`Delete seller "${link.promoter_name}"?`)) return;
    await base44.entities.SellerLink.delete(link.id);
    setLinks(prev => prev.filter(l => l.id !== link.id));
    toast.success("Seller deleted");
  };

  const toggleStatus = async (link) => {
    const newStatus = link.status === "active" ? "inactive" : "active";
    await base44.entities.SellerLink.update(link.id, { status: newStatus });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: newStatus } : l));
    toast.success(`Seller ${newStatus === "active" ? "activated" : "deactivated"}`);
  };

  // Build seller URL always using reizor.com
  const getSellerUrl = (link) => {
    if (!link.event_id) return null;
    return `https://reizor.com/events/${link.event_id}?seller=${link.tracking_code}`;
  };

  const buildPromoMessage = (link) => {
    const url = getSellerUrl(link);
    const ev = events.find(e => e.id === link.event_id);
    if (!url || !ev) {
      // General (no event) message
      return `🎟 Buy tickets from ${link.promoter_name} on Reizor. Explore upcoming events and secure your tickets here:\n\n${url || "https://reizor.com"}`;
    }
    const dateStr = ev.date
      ? new Date(ev.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : null;
    const timeStr = ev.doors_open ? ` · Doors ${ev.doors_open}` : "";
    const location = [ev.venue_name, ev.city, ev.state].filter(Boolean).join(", ");
    const artistLine = ev.artist_names?.length
      ? `featuring ${Array.isArray(ev.artist_names) ? ev.artist_names.join(", ") : ev.artist_names}`
      : ev.lineup?.length
        ? `featuring ${ev.lineup.slice(0, 2).map(a => a.name || a).join(", ")}${ev.lineup.length > 2 ? " & more" : ""}`
        : null;

    const lines = [
      `🎉 ${link.promoter_name} invites you to ${ev.title}!`,
      "",
      `Join us for an unforgettable night${artistLine ? ` ${artistLine}` : ""}${dateStr ? ` on ${dateStr}${timeStr}` : ""}${location ? ` at ${location}` : ""}.`,
      "",
      "Tickets are available now. Secure yours before they sell out:",
      "",
      url,
    ];
    return lines.join("\n");
  };

  const copyLink = async (link) => {
    const msg = buildPromoMessage(link);
    const ok = await copyToClipboard(msg);
    if (ok) {
      setCopiedId(link.id);
      toast.success("Event message and seller link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast.error("Could not copy. Please try again.");
    }
  };

  const copyRawLink = async (link) => {
    const url = getSellerUrl(link);
    if (!url) { toast.info("Assign an event first to generate a link"); return; }
    const ok = await copyToClipboard(url);
    if (ok) toast.success("Raw link copied!");
    else toast.error("Could not copy: " + url);
  };

  const shareLink = async (link) => {
    const url = getSellerUrl(link);
    const ev = events.find(e => e.id === link.event_id);
    const title = ev?.title || link.event_title || "Event";
    const text = buildPromoMessage(link);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} Tickets`, text, url: url || "https://reizor.com" });
      } catch { /* user cancelled */ }
    } else {
      // Fallback: copy message
      const ok = await copyToClipboard(text);
      if (ok) toast.success("Share message copied to clipboard!");
    }
  };

  const toggleSellerOrders = async (link) => {
    if (expandedSellerId === link.id) {
      setExpandedSellerId(null);
      return;
    }
    setExpandedSellerId(link.id);
    if (sellerOrders[link.id]) return; // already loaded

    setLoadingOrders(prev => ({ ...prev, [link.id]: true }));
    // Search orders by seller_link_id first, fall back to seller_link_code
    const [byId, byCode] = await Promise.all([
      link.id
        ? base44.entities.Order.filter({ seller_link_id: link.id, status: "completed" }, "-created_date", 100).catch(() => [])
        : Promise.resolve([]),
      link.tracking_code
        ? base44.entities.Order.filter({ seller_link_code: link.tracking_code, status: "completed" }, "-created_date", 100).catch(() => [])
        : Promise.resolve([]),
    ]);
    // Deduplicate by order id
    const seen = new Set();
    const combined = [...byId, ...byCode].filter(o => seen.has(o.id) ? false : seen.add(o.id));
    setSellerOrders(prev => ({ ...prev, [link.id]: combined }));
    setLoadingOrders(prev => ({ ...prev, [link.id]: false }));
  };

  const showQR = async (link) => {
    const url = `${window.location.origin}/events/${link.event_id}?seller=${link.tracking_code}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    setQrDataUrl(dataUrl);
    setQrModal({ id: link.id, url, name: link.promoter_name, code: link.tracking_code });
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `seller-${qrModal.code}-qr.png`;
    a.click();
  };

  const totalRevenue = filtered.reduce((s, l) => s + (l.total_revenue || 0), 0);
  const totalTickets = filtered.reduce((s, l) => s + (l.tickets_sold || 0), 0);
  const totalCommission = filtered.reduce((s, l) => s + (l.commission_earned || 0), 0);

  // Role gate — must be organizer or admin to use this page
  if (user && user.role !== "organizer" && user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-destructive/40 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="font-display font-black text-xl">Access Restricted</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You need the <span className="font-bold text-foreground">Organizer</span> role to manage ticket sellers.
          </p>
          <div className="p-3 rounded-lg bg-secondary border border-border/50 text-xs font-mono text-muted-foreground">
            Current role: <span className="text-destructive font-bold">{user.role || "user"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Contact an admin to upgrade your account, or switch to an organizer account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> TICKET SELLERS
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">
            Create and manage ticket sellers — generate unique sale links and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {links.length > 0 && (
            <Button size="sm" onClick={openNew} className="gap-1.5 glow-lime font-bold">
              <Plus className="w-3.5 h-3.5" /> Add Seller
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card border border-border/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("sellers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "sellers"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" /> All Sellers
        </button>
        <button
          onClick={() => setActiveTab("top")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "top"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="w-4 h-4" /> Top Sellers
        </button>
      </div>

      {/* ── Post-creation success panel ── */}
      {createdLink && (() => {
        const hasEvent = !!createdLink.event_id;
        const sellerUrl = hasEvent ? `${window.location.origin}/events/${createdLink.event_id}?seller=${createdLink.tracking_code}` : null;
        return (
          <div className="p-5 rounded-xl bg-green-400/10 border border-green-400/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <p className="font-display font-bold text-base">Seller Created!</p>
              </div>
              <button onClick={() => setCreatedLink(null)} className="text-muted-foreground hover:text-foreground text-lg font-bold leading-none">×</button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-muted-foreground">
                Seller: <span className="text-foreground font-bold">{createdLink.promoter_name}</span>
              </p>
              {hasEvent ? (
                <div className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary border border-border/50 font-mono text-xs text-accent truncate">
                    {sellerUrl}
                  </div>
                  <Button size="sm" className="shrink-0 gap-1.5 glow-lime font-bold" onClick={async () => {
                    const ok = await copyToClipboard(sellerUrl);
                    if (ok) toast.success("Seller link copied!");
                    else toast.error("Could not copy — please copy manually: " + sellerUrl);
                  }}>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </Button>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => showQR(createdLink)}>
                    <QrCode className="w-3.5 h-3.5" /> QR Code
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">No event assigned. Edit this seller to attach them to an event and generate a tracking link.</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Summary stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Sellers", value: filtered.length },
            { label: "Tickets Sold", value: totalTickets },
            { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}` },
            { label: "Commission Owed", value: `$${totalCommission.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="font-mono font-bold text-xl mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top Sellers Tab */}
      {activeTab === "top" && (
        <TopSellersTab links={links} events={events} />
      )}

      {/* All Sellers Tab content below */}
      {activeTab === "sellers" && <>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <Label className="text-xs font-mono text-muted-foreground">Search</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name or email..." className="pl-8 bg-card border-border/50 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Event</Label>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        links.length === 0 ? (
          <div className="py-8 sm:py-12 rounded-xl bg-card border border-border/50 text-center space-y-2.5 px-6">
            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-display font-bold text-lg">No Ticket Sellers Yet</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Create a seller to generate a unique tracking link and QR code.</p>
            <Button onClick={openNew} className="gap-2 mt-1"><Plus className="w-4 h-4" /> Add First Seller</Button>
          </div>
        ) : (
          <div className="py-16 rounded-xl bg-card border border-border/50 text-center space-y-3 px-6">
            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-display font-bold text-lg">No Matching Sellers</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Try adjusting your search or filters.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {filtered.map(link => {
            const ticketLimit = link.max_tickets > 0;
            const tableLimit = link.max_tables > 0;
            const ticketsFull = ticketLimit && link.tickets_sold >= link.max_tickets;
            const tablesFull = tableLimit && link.tables_sold >= link.max_tables;
            const isExpired = link.expiry_date && new Date(link.expiry_date) < new Date();
            const isActive = link.status === "active" && !isExpired;
            const eventTitle = events.find(e => e.id === link.event_id)?.title || link.event_title || link.event_id;

            return (
              <div key={link.id} className={`rounded-xl bg-card border overflow-hidden ${isActive ? "border-border/50" : "border-border/20 opacity-70"}`}>
                {/* Card Header */}
                <div className="p-4 pb-3">
                  {/* Row 1: Name + status badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-bold text-base leading-tight">{link.promoter_name}</p>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isExpired ? "text-destructive bg-destructive/10 border border-destructive/20" :
                        link.status === "active" ? "text-green-400 bg-green-400/10 border border-green-400/20" :
                        "text-muted-foreground bg-muted border border-border/50"
                      }`}>
                        {isExpired ? "EXPIRED" : link.status.toUpperCase()}
                      </span>

                    </div>
                  </div>

                  {/* Row 2: Event */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <span className="text-primary/70">📅</span>
                    <span className="truncate font-medium">{eventTitle || <span className="italic text-muted-foreground/60">No event assigned</span>}</span>
                  </div>

                  {/* Row 3: Contact info */}
                  {(link.promoter_email || link.promoter_phone) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-1.5">
                      {link.promoter_email && (
                        <span className="flex items-center gap-1">
                          <span>✉</span> {link.promoter_email}
                        </span>
                      )}
                      {link.promoter_phone && (
                        <span className="flex items-center gap-1">
                          <span>📞</span> {link.promoter_phone}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 4: Extra metadata */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                    {link.custom_ticket_price > 0 && <span>🎟 Custom ticket: ${link.custom_ticket_price}</span>}
                    {link.custom_table_price > 0 && <span>🪑 Custom table: ${link.custom_table_price}</span>}
                    {link.expiry_date && (
                      <span className={isExpired ? "text-destructive" : ""}>
                        ⏱ {isExpired ? "Expired" : "Expires"}: {format(new Date(link.expiry_date), "MMM d, yyyy")}
                      </span>
                    )}
                    {link.last_sale_date && <span>Last sale: {format(new Date(link.last_sale_date), "MMM d, yyyy")}</span>}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border/40 divide-x divide-y sm:divide-y-0 divide-border/40">
                  <div className="p-2.5 sm:p-3 text-center">
                    <p className="font-mono text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wide">Tickets</p>
                    <p className="font-bold text-xs sm:text-sm mt-0.5">
                      {link.tickets_sold || 0}
                      {ticketLimit && <span className="text-muted-foreground font-normal text-[9px] sm:text-[10px]">/{link.max_tickets}</span>}
                    </p>
                    {ticketsFull && <p className="text-[7px] sm:text-[8px] text-destructive font-mono">FULL</p>}
                  </div>
                  <div className="p-2.5 sm:p-3 text-center">
                    <p className="font-mono text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wide">Tables</p>
                    <p className="font-bold text-xs sm:text-sm mt-0.5">
                      {link.tables_sold || 0}
                      {tableLimit && <span className="text-muted-foreground font-normal text-[9px] sm:text-[10px]">/{link.max_tables}</span>}
                    </p>
                    {tablesFull && <p className="text-[7px] sm:text-[8px] text-destructive font-mono">FULL</p>}
                  </div>
                  <div className="p-2.5 sm:p-3 text-center">
                    <p className="font-mono text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wide">Revenue</p>
                    <p className="font-bold text-xs sm:text-sm text-green-400 mt-0.5">${(link.total_revenue || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 text-center">
                    <p className="font-mono text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wide">Commission</p>
                    <p className="font-bold text-xs sm:text-sm text-yellow-400 mt-0.5">${(link.commission_earned || 0).toFixed(2)}</p>
                    {link.commission_type !== "none" && (
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground font-mono">
                        {link.commission_type === "fixed" ? `$${link.commission_value}/ea` : `${link.commission_value}%`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sales drill-down */}
                {expandedSellerId === link.id && (
                  <div className="border-t border-border/40 bg-secondary/10 p-4">
                    {loadingOrders[link.id] ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : !sellerOrders[link.id]?.length ? (
                      <p className="text-xs text-muted-foreground font-mono text-center py-3">No completed sales found for this seller yet.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                          {sellerOrders[link.id].length} sale{sellerOrders[link.id].length !== 1 ? "s" : ""} found
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border/40">
                                <th className="text-left py-1.5 pr-3">Event</th>
                                <th className="text-left py-1.5 pr-3">Buyer</th>
                                <th className="text-left py-1.5 pr-3">Order #</th>
                                <th className="text-right py-1.5 pr-3">Qty</th>
                                <th className="text-right py-1.5 pr-3">Revenue</th>
                                <th className="text-right py-1.5">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sellerOrders[link.id].map(o => {
                                let commission = 0;
                                if (link.commission_type === "fixed") commission = (link.commission_value || 0) * (o.quantity || 0);
                                else if (link.commission_type === "percentage") commission = (o.total || 0) * ((link.commission_value || 0) / 100);
                                return (
                                  <tr key={o.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                                    <td className="py-2 pr-3 font-medium max-w-[120px] truncate">{o.event_title || "—"}</td>
                                    <td className="py-2 pr-3 text-muted-foreground max-w-[120px] truncate">{o.customer_name || o.customer_email || "—"}</td>
                                    <td className="py-2 pr-3 font-mono text-muted-foreground text-[10px]">{o.order_number || o.id?.slice(-8)?.toUpperCase()}</td>
                                    <td className="py-2 pr-3 text-right font-mono">{o.quantity || "—"}</td>
                                    <td className="py-2 pr-3 text-right font-mono text-green-400">${(o.total || 0).toFixed(2)}</td>
                                    <td className="py-2 text-right font-mono text-muted-foreground text-[10px] whitespace-nowrap">
                                      {o.paid_at ? format(new Date(o.paid_at), "MMM d, yy") : o.created_date ? format(new Date(o.created_date), "MMM d, yy") : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {sellerOrders[link.id].length > 0 && (() => {
                              const totalRev = sellerOrders[link.id].reduce((s, o) => s + (o.total || 0), 0);
                              const totalQtyOrders = sellerOrders[link.id].reduce((s, o) => s + (o.quantity || 0), 0);
                              return (
                                <tfoot>
                                  <tr className="border-t border-border/50 font-bold text-foreground">
                                    <td className="pt-2 pr-3" colSpan="3">Total</td>
                                    <td className="pt-2 pr-3 text-right font-mono">{totalQtyOrders}</td>
                                    <td className="pt-2 pr-3 text-right font-mono text-green-400">${totalRev.toFixed(2)}</td>
                                    <td className="pt-2" />
                                  </tr>
                                </tfoot>
                              );
                            })()}
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons row */}
                 <div className="flex items-center gap-2 p-3 pt-2.5 border-t border-border/40 bg-secondary/20 flex-wrap">
                   {/* Main share: copies promo message + link */}
                   <button onClick={() => link.event_id ? copyLink(link) : toast.info("Assign an event to this seller first to generate a link")} title="Copy promotional message & link"
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${link.event_id ? "border-primary/40 hover:border-primary/70 text-primary hover:text-primary" : "border-border/30 text-muted-foreground/40 cursor-default"}`}>
                     {copiedId === link.id ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy Message</span></>}
                   </button>
                   {/* Device share */}
                   <button onClick={() => link.event_id ? shareLink(link) : toast.info("Assign an event to this seller first")} title="Share via device"
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${link.event_id ? "border-border/50 hover:border-accent/50 text-muted-foreground hover:text-accent" : "border-border/30 text-muted-foreground/40 cursor-default"}`}>
                     <Share2 className="w-3.5 h-3.5" /><span>Share</span>
                   </button>
                   {/* Raw link only */}
                   <button onClick={() => copyRawLink(link)} title="Copy raw URL only"
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${link.event_id ? "border-border/50 hover:border-border text-muted-foreground/60 hover:text-muted-foreground" : "border-border/30 text-muted-foreground/30 cursor-default"}`}>
                     <ExternalLink className="w-3.5 h-3.5" /><span>Raw Link</span>
                   </button>
                   <button onClick={() => link.event_id ? showQR(link) : toast.info("Assign an event to this seller first")} title="Show QR code"
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${link.event_id ? "border-border/50 hover:border-accent/50 text-muted-foreground hover:text-accent" : "border-border/30 text-muted-foreground/40 cursor-default"}`}>
                     <QrCode className="w-3.5 h-3.5" /><span>QR</span>
                   </button>
                  {link.event_id && (
                    <a href={`https://reizor.com/events/${link.event_id}?seller=${link.tracking_code}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 hover:border-accent/50 text-xs text-muted-foreground hover:text-accent transition-colors bg-card/50 min-h-[36px]">
                      <ExternalLink className="w-3.5 h-3.5" /><span>Preview</span>
                    </a>
                  )}
                  <button onClick={() => toggleStatus(link)} title={isActive ? "Deactivate" : "Activate"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${
                      isActive ? "border-green-400/30 text-green-400 hover:bg-green-400/10" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}>
                    <Power className="w-3.5 h-3.5" /><span>{isActive ? "Deactivate" : "Activate"}</span>
                  </button>
                  <button onClick={() => openEdit(link)} title="Edit"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors bg-card/50 min-h-[36px]">
                    <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                  </button>
                  <button onClick={() => toggleSellerOrders(link)} title="View sales details"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors bg-card/50 min-h-[36px] ${expandedSellerId === link.id ? "border-accent/50 text-accent bg-accent/10" : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-accent"}`}>
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Sales</span>
                    {expandedSellerId === link.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button onClick={() => handleDelete(link)} title="Delete"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 transition-colors bg-card/50 min-h-[36px] ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                  </button>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      </> /* end sellers tab */}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setFormErrors({}); }}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-black">
              {editing ? "Edit Ticket Seller" : "New Ticket Seller"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Event selection — optional */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Event <span className="text-muted-foreground/60">(Optional)</span></Label>
              <p className="text-[11px] text-muted-foreground font-mono mb-1">Optional: Select an event now or assign this seller later.</p>
              {events.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground font-mono">No published events found — seller will be saved without an event.</p>
              ) : (
                <Select value={form.event_id || "none"} onValueChange={v => setForm(f => ({ ...f, event_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50">
                    <SelectValue placeholder="No event — assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event — assign later</SelectItem>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Seller Name *</Label>
                <Input value={form.promoter_name}
                  onChange={e => { setForm(f => ({ ...f, promoter_name: e.target.value })); setFormErrors(err => ({ ...err, promoter_name: undefined })); }}
                  placeholder="John Smith"
                  className={`mt-1 bg-secondary ${formErrors.promoter_name ? "border-destructive" : "border-border/50"}`} />
                {formErrors.promoter_name && <p className="mt-1 text-xs text-destructive font-mono">{formErrors.promoter_name}</p>}
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                <Input value={form.promoter_email} onChange={e => setForm(f => ({ ...f, promoter_email: e.target.value }))}
                  placeholder="seller@email.com" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Phone</Label>
                <Input value={form.promoter_phone} onChange={e => setForm(f => ({ ...f, promoter_phone: e.target.value }))}
                  placeholder="+1 555 000 0000" className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground">Seller Link</Label>
              <div className="flex flex-col gap-2">
                <div className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
                  {(form.event_id && form.event_id !== "none") ? (
                    <p className="text-xs font-mono text-accent break-all">
                      {window.location.origin}/events/{form.event_id}?seller={form.tracking_code}
                    </p>
                  ) : (
                    <p className="text-xs font-mono text-muted-foreground">Select an event to generate an event-specific seller link.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 flex-1"
                    disabled={!form.event_id || form.event_id === "none"}
                    onClick={async () => {
                      const url = `${window.location.origin}/events/${form.event_id}?seller=${form.tracking_code}`;
                      const ok = await copyToClipboard(url);
                      if (ok) toast.success("Link copied!"); else toast.error("Could not copy");
                    }}>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 flex-1"
                    onClick={() => { setForm(f => ({ ...f, tracking_code: generateCode() })); setFormErrors(err => ({ ...err, tracking_code: undefined })); }}>
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Max Tickets (0 = unlimited)</Label>
                <Input type="number" value={form.max_tickets}
                  onChange={e => setForm(f => ({ ...f, max_tickets: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Max Tables (0 = unlimited)</Label>
                <Input type="number" value={form.max_tables}
                  onChange={e => setForm(f => ({ ...f, max_tables: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Custom Ticket Price (0 = default)</Label>
                <Input type="number" value={form.custom_ticket_price}
                  onChange={e => setForm(f => ({ ...f, custom_ticket_price: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Custom Table Price (0 = default)</Label>
                <Input type="number" value={form.custom_table_price}
                  onChange={e => setForm(f => ({ ...f, custom_table_price: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            {/* Commission */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Commission Type</Label>
                <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden">
                  {[{ v: "none", l: "None" }, { v: "fixed", l: "Fixed $" }, { v: "percentage", l: "%" }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, commission_type: v }))}
                      className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${form.commission_type === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {form.commission_type !== "none" && (
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">
                    Commission {form.commission_type === "fixed" ? "($) per ticket" : "(%) of total"}
                  </Label>
                  <Input type="number" value={form.commission_value}
                    onChange={e => { setForm(f => ({ ...f, commission_value: e.target.value })); setFormErrors(err => ({ ...err, commission_value: undefined })); }}
                    placeholder="0" className={`mt-1 bg-secondary ${formErrors.commission_value ? "border-destructive" : "border-border/50"}`} />
                  {formErrors.commission_value && <p className="mt-1 text-xs text-destructive font-mono">{formErrors.commission_value}</p>}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Start Date (optional)</Label>
                <Input type="datetime-local" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Expiry Date (optional)</Label>
                <Input type="datetime-local" value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                  className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Status</Label>
              <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden w-40">
                {["active", "inactive"].map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-2 text-xs font-mono font-bold capitalize transition-all ${form.status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 glow-lime font-bold">
                {saving ? "Saving..." : editing ? "Update Seller" : "Create Seller"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrModal} onOpenChange={() => setQrModal(null)}>
        <DialogContent className="bg-card border-border max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display font-black">QR Code — {qrModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            {qrDataUrl && (
              <div className="bg-white p-3 rounded-xl">
                <img src={qrDataUrl} alt="Seller QR Code" className="w-56 h-56" />
              </div>
            )}
            <p className="text-xs font-bold text-foreground">{qrModal?.name}</p>
            <div className="flex gap-2 w-full">
              <Button onClick={downloadQR} className="flex-1 gap-2 glow-lime font-bold">
                <Download className="w-4 h-4" /> Download QR
              </Button>
              <Button variant="outline" onClick={async () => {
                const ok = await copyToClipboard(qrModal?.url || "");
                if (ok) toast.success("Seller link copied!");
                else toast.error("Could not copy — please copy manually: " + (qrModal?.url || ""));
              }} className="gap-1.5 flex-1" title="Copy seller link">
                <Copy className="w-4 h-4" /> Copy Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}