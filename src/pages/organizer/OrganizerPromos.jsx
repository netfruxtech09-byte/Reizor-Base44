import { useState, useEffect, useMemo } from "react";
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight, Calendar, Clock, Pencil, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

export default function OrganizerPromos() {
  const [promos, setPromos] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: "delete"|"toggle", promo }
  const [canManage, setCanManage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [codeError, setCodeError] = useState("");
  const [form, setForm] = useState({
    code: "", event_id: "", discount_type: "percentage", discount_value: "", max_uses: "",
    valid_from: "", valid_until: "", status: "active",
  });

  const openEdit = (promo) => {
    setEditingPromo(promo);
    // Ensure discount_value is always stored as a string for the form
    const rawVal = promo.discount_value;
    const discountStr = (rawVal !== null && rawVal !== undefined) ? String(rawVal) : "";
    setForm({
      code: promo.code || "",
      event_id: promo.event_id || "",
      discount_type: promo.discount_type || "percentage",
      discount_value: discountStr,
      max_uses: promo.max_uses != null ? String(promo.max_uses) : "",
      valid_from: promo.valid_from ? new Date(promo.valid_from).toISOString().slice(0, 16) : "",
      valid_until: promo.valid_until ? new Date(promo.valid_until).toISOString().slice(0, 16) : "",
      status: promo.status || "active",
    });
    setOpen(true);
  };

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      // Admins and organizers always have access; sub-roles need can_manage_promos permission
      if (user.role === "admin" || user.role === "organizer") {
        setCanManage(true);
      } else {
        const perms = await base44.entities.Permission.filter({ user_email: user.email, status: "active" }, null, 1).catch(() => []);
        setCanManage(perms.length > 0 && perms[0].can_manage_promos === true);
      }
      const isAdmin = user.role === "admin";
      // Fetch only this user's events (or all for admin)
      // Match on both organizer_id AND created_by to cover all cases
      const allEvents = isAdmin
        ? await base44.entities.Event.list("-created_date", 100)
        : await base44.entities.Event.list("-created_date", 200);

      const e = isAdmin
        ? allEvents
        : allEvents.filter(ev => ev.organizer_id === user.id || ev.created_by === user.email);

      // Only show promo codes that belong to this user's own events
      const myEventIds = new Set(e.map(ev => ev.id));
      const allPromos = await base44.entities.PromoCode.list("-created_date", 500);
      const p = isAdmin
        ? allPromos
        : allPromos.filter(promo => promo.event_id && myEventIds.has(promo.event_id));

      setPromos(p);
      setEvents(e);
      setLoading(false);
    };
    load();
  }, []);

  const handleCodeChange = (val) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setForm(f => ({ ...f, code: upper }));
    setCodeError(upper && !/^[A-Z0-9]+$/.test(upper) ? "Only letters and numbers allowed" : "");
  };

  const handleSave = async () => {
    if (!form.code || !form.event_id || !form.discount_value) {
      toast.error("Fill in all required fields");
      return;
    }
    if (!/^[A-Z0-9]+$/.test(form.code)) {
      toast.error("Code must be alphanumeric only");
      return;
    }
    const discVal = Number(form.discount_value);
    if (form.discount_type === "percentage" && (discVal < 1 || discVal > 100)) {
      toast.error("Percentage must be between 1 and 100");
      return;
    }

    if (form.valid_from && form.valid_until && new Date(form.valid_until) <= new Date(form.valid_from)) {
      toast.error("Expiry date must be after start date");
      return;
    }

    const payload = {
      code: form.code.toUpperCase(),
      event_id: form.event_id,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      // Preserve the exact value — no rounding or conversion beyond Number()
      max_uses: form.max_uses ? Number(form.max_uses) : 999,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : undefined,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : undefined,
      status: form.status || "active",
    };

    if (editingPromo) {
      const updated = await base44.entities.PromoCode.update(editingPromo.id, payload);
      setPromos(promos.map(p => p.id === editingPromo.id ? { ...p, ...updated } : p));
      toast.success("Promo code updated");
    } else {
      const promo = await base44.entities.PromoCode.create({ ...payload, status: "active" });
      setPromos([promo, ...promos]);
      toast.success("Promo code created");
    }

    setOpen(false);
    setEditingPromo(null);
    setForm({ code: "", event_id: "", discount_type: "percentage", discount_value: "", max_uses: "", valid_from: "", valid_until: "", status: "active" });
  };

  const handleDelete = async (id) => {
    await base44.entities.PromoCode.delete(id);
    setPromos(promos.filter((p) => p.id !== id));
    toast.success("Promo code deleted");
  };

  const handleToggleStatus = async (promo) => {
    const newStatus = promo.status === "active" ? "disabled" : "active";
    await base44.entities.PromoCode.update(promo.id, { status: newStatus });
    setPromos(promos.map((p) => p.id === promo.id ? { ...p, status: newStatus } : p));
    toast.success(`Promo code ${newStatus === "active" ? "enabled" : "disabled"}`);
  };

  const filteredPromos = useMemo(() => {
    return promos.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        p.code?.toLowerCase().includes(q) ||
        events.find(e => e.id === p.event_id)?.title?.toLowerCase().includes(q);
      const matchesEvent = filterEvent === "all" || p.event_id === filterEvent;
      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesEvent && matchesStatus;
    });
  }, [promos, events, search, filterEvent, filterStatus]);

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === "delete") {
      await handleDelete(confirm.promo.id);
    } else if (confirm.type === "toggle") {
      await handleToggleStatus(confirm.promo);
    }
    setConfirm(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Tag className="w-10 h-10 text-muted-foreground/30" />
        <h2 className="font-display font-black text-xl">Access Restricted</h2>
        <p className="text-muted-foreground text-sm max-w-xs">You don't have permission to manage promo codes. Ask an organizer or admin to enable <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">can_manage_promos</span> for your account.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-3xl tracking-tight">PROMO CODES</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingPromo(null); setForm({ code: "", event_id: "", discount_type: "percentage", discount_value: "", max_uses: "", valid_from: "", valid_until: "", status: "active" }); } }}>
          <DialogTrigger asChild>
            <Button className="glow-lime font-display font-bold gap-2">
              <Plus className="w-4 h-4" /> New Code
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display font-black">
                {editingPromo ? `Edit: ${editingPromo.code}` : "Create Promo Code"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Code <span className="text-muted-foreground/60">(letters & numbers only)</span></Label>
                <Input value={form.code} onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="SUMMER2026" className="mt-1 bg-secondary border-border/50 uppercase font-mono" maxLength={30} />
                {codeError && <p className="text-destructive text-xs mt-1">{codeError}</p>}
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Event</Label>
                <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Type</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger className="mt-1 bg-secondary border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Value</Label>
                  <Input type="number" value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder={form.discount_type === "percentage" ? "20" : "10"}
                    className="mt-1 bg-secondary border-border/50" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Max Uses (leave blank for unlimited)</Label>
                <Input type="number" value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="100" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date &amp; Time Range — leave blank for no time limit
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Start Date &amp; Time
                    </Label>
                    <Input type="datetime-local" value={form.valid_from}
                      onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                      placeholder="Select start date"
                      className="mt-1 bg-secondary border-border/50 cursor-pointer" />
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Expiry Date &amp; Time
                    </Label>
                    <Input type="datetime-local" value={form.valid_until}
                      onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                      placeholder="Select expiry date"
                      className="mt-1 bg-secondary border-border/50 cursor-pointer" />
                  </div>
                </div>
              </div>
              {editingPromo && (
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1 bg-secondary border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleSave} className="w-full glow-lime font-display font-bold">
                {editingPromo ? "Save Changes" : "Create Code"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Filters */}
      {promos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search codes or events..."
              className="pl-8 bg-secondary border-border/50 text-sm h-9"
            />
          </div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-44 bg-secondary border-border/50 text-sm h-9">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 bg-secondary border-border/50 text-sm h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-border/50">
          <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No promo codes yet</p>
        </div>
      ) : filteredPromos.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border/50">
          <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No codes match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPromos.map((promo) => {
            const ev = events.find((e) => e.id === promo.event_id);
            return (
              <div key={promo.id} className="p-4 bg-card rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-bold text-primary">{promo.code}</p>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {promo.discount_type === "percentage" ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{promo.times_used || 0}/{promo.max_uses} used</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        promo.status === "active" ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"
                      }`}>{promo.status === "active" ? "ACTIVE" : "DISABLED"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{ev?.title || "Unknown event"}</p>
                    {promo.tier_name && (
                      <p className="text-[10px] font-mono text-accent mt-0.5">🎟 {promo.tier_name} only</p>
                    )}
                    {(promo.valid_from || promo.valid_until) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {promo.valid_from ? format(new Date(promo.valid_from), "MMM d") : ""}
                          {promo.valid_from && promo.valid_until ? " – " : ""}
                          {promo.valid_until ? format(new Date(promo.valid_until), "MMM d, yyyy") : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setConfirm({ type: "toggle", promo })}
                      title={promo.status === "active" ? "Disable" : "Enable"}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                    >
                      {promo.status === "active"
                        ? <ToggleRight className="w-5 h-5 text-primary" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={() => openEdit(promo)} title="Edit promo code">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirm({ type: "delete", promo })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <ConfirmDialog
      open={!!confirm}
      onOpenChange={(v) => { if (!v) setConfirm(null); }}
      title={
        confirm?.type === "delete"
          ? `Delete "${confirm.promo.code}"?`
          : confirm?.type === "toggle" && confirm.promo.status === "active"
            ? `Disable "${confirm.promo.code}"?`
            : `Enable "${confirm?.promo?.code}"?`
      }
      description={
        confirm?.type === "delete"
          ? "This will permanently delete this promo code. This action cannot be undone."
          : confirm?.type === "toggle" && confirm.promo.status === "active"
            ? "This promo code will stop working for new purchases immediately."
            : "This promo code will become active and usable again."
      }
      confirmLabel={
        confirm?.type === "delete"
          ? "Delete"
          : confirm?.type === "toggle" && confirm.promo.status === "active"
            ? "Disable"
            : "Enable"
      }
      confirmVariant={confirm?.type === "delete" ? "destructive" : "default"}
      onConfirm={handleConfirm}
    />
    </>
  );
}