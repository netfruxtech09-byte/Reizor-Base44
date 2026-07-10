import { useState, useEffect, useRef } from "react";
import {
  Users, Plus, CheckCircle2, Circle, Pencil, Trash2,
  BarChart3, X, Upload, Download, Search, Filter, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const GUEST_TYPES = [
  "Artist Guest",
  "Production Guest",
  "Organizer Guest",
  "Media Guest",
  "Staff Guest",
  "Custom",
];

const TYPE_COLORS = {
  "Artist Guest":     "bg-purple-400/15 text-purple-400",
  "Production Guest": "bg-blue-400/15 text-blue-400",
  "Organizer Guest":  "bg-primary/10 text-primary",
  "Media Guest":      "bg-cyan-400/15 text-cyan-400",
  "Staff Guest":      "bg-muted text-muted-foreground",
  "Custom":           "bg-accent/10 text-accent",
};

const EMPTY_FORM = {
  first_name: "", last_name: "", email: "", phone: "",
  guest_type: "Organizer Guest", custom_label: "",
  whose_guest: "", ticket_type: "",
  allowed_count: 1, notes: "",
};

export default function GuestListManager({ event }) {
  const [guests, setGuests]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [errors, setErrors]             = useState({});
  const [user, setUser]                 = useState(null);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // CSV import state
  const [importRows, setImportRows]     = useState([]);
  const [importing, setImporting]       = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.GuestList.filter({ event_id: event.id }, "first_name", 500),
      base44.auth.me().catch(() => null),
    ]).then(([g, u]) => {
      setGuests(g);
      setUser(u);
      setLoading(false);
    });
  }, [event.id]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getLabel = (g) =>
    g.guest_type === "Custom" && g.custom_label ? g.custom_label : g.guest_type;

  const isDuplicate = (f, skipId = null) => {
    const nameKey = `${f.first_name.trim()} ${f.last_name.trim()}`.toLowerCase();
    return guests.find(g => {
      if (g.id === skipId) return false;
      if (f.email && g.email && f.email.toLowerCase() === g.email.toLowerCase()) return true;
      if (f.phone && g.phone && f.phone === g.phone) return true;
      return `${g.first_name} ${g.last_name}`.toLowerCase() === nameKey && g.guest_type === f.guest_type;
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = "First name required";
    if (!form.last_name.trim()) e.last_name = "Last name required";
    if (form.guest_type === "Custom" && !form.custom_label.trim()) e.custom_label = "Custom label required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    const dup = isDuplicate(form, editingId);
    if (dup) e.first_name = `"${dup.first_name} ${dup.last_name}" already exists on this guest list`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      event_id: event.id,
      event_title: event.title,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      guest_type: form.guest_type,
      custom_label: form.guest_type === "Custom" ? form.custom_label.trim() : "",
      whose_guest: form.whose_guest.trim(),
      ticket_type: form.ticket_type.trim() || "General",
      allowed_count: Number(form.allowed_count) || 1,
      notes: form.notes.trim(),
      added_by_name: user?.full_name || user?.email || "Unknown",
      added_by_email: user?.email || "",
      source: "manual",
    };
    if (editingId) {
      const updated = await base44.entities.GuestList.update(editingId, payload);
      setGuests(prev => prev.map(g => g.id === editingId ? { ...g, ...updated } : g));
      toast.success("Guest updated");
    } else {
      const created = await base44.entities.GuestList.create(payload);
      setGuests(prev => [...prev, created]);
      toast.success("Guest added to list");
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
  };

  const handleEdit = (guest) => {
    setForm({
      first_name: guest.first_name || "",
      last_name: guest.last_name || "",
      email: guest.email || "",
      phone: guest.phone || "",
      guest_type: guest.guest_type || "Organizer Guest",
      custom_label: guest.custom_label || "",
      whose_guest: guest.whose_guest || "",
      ticket_type: guest.ticket_type || "",
      allowed_count: guest.allowed_count || 1,
      notes: guest.notes || "",
    });
    setEditingId(guest.id);
    setErrors({});
    setShowForm(true);
    setShowImport(false);
  };

  const handleDelete = async (guest) => {
    if (guest.checked_in) {
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        toast.error("Attended guests cannot be removed.");
        return;
      }
    }
    await base44.entities.GuestList.delete(guest.id);
    setGuests(prev => prev.filter(g => g.id !== guest.id));
    toast.success("Guest removed");
  };

  const handleCheckIn = async (guest) => {
    const now = new Date().toISOString();
    // Prevent double check-in (toggle is allowed for undo)
    const data = guest.checked_in
      ? { checked_in: false, checked_in_at: null, checked_in_by: null }
      : { checked_in: true, checked_in_at: now, checked_in_by: user?.full_name || user?.email || "Unknown" };
    await base44.entities.GuestList.update(guest.id, data);
    setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, ...data } : g));
    toast.success(guest.checked_in ? "Check-in removed" : "Guest marked as attended ✓");
  };

  const cancelForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setShowForm(false);
  };

  // ── CSV Import ────────────────────────────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(Boolean);
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes("name") || header.includes("email") || header.includes("guest");
    const rows = hasHeader ? lines.slice(1) : lines;
    return rows.map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      // Support: name/first_name, last_name/email, phone, guest_type, custom_label, allowed_count, whose_guest, ticket_type
      const [nameOrFirst, emailOrLast, phone, guest_type, custom_label, allowed_count, whose_guest, ticket_type] = cols;
      // If col[1] looks like email, treat col[0] as full name
      const isEmail = (s) => s && s.includes("@");
      let first_name = "", last_name = "", email = "", phoneVal = "";
      if (isEmail(emailOrLast)) {
        // name, email, ...
        const parts = (nameOrFirst || "").split(" ");
        first_name = parts[0] || "Guest";
        last_name = parts.slice(1).join(" ") || "-";
        email = emailOrLast || "";
        phoneVal = phone || "";
      } else {
        // first_name, last_name, phone, ...
        first_name = nameOrFirst || "Guest";
        last_name = emailOrLast || "-";
        phoneVal = phone || "";
      }
      return {
        first_name, last_name, email,
        phone: phoneVal,
        guest_type: guest_type || "Organizer Guest",
        custom_label: custom_label || "",
        whose_guest: whose_guest || "",
        ticket_type: ticket_type || "General",
        allowed_count: Number(allowed_count) || 1,
        _error: null,
        _dup: false,
      };
    }).map(row => {
      // Flag duplicates in preview
      row._dup = !!isDuplicate(row);
      if (!row.first_name) row._error = "Name missing";
      return row;
    }).filter(r => r.first_name !== "Guest" || r.email || r._error);
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result);
      setImportRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    const valid = importRows.filter(r => !r._dup && !r._error);
    if (!valid.length) { toast.error("No valid guests to import"); return; }
    setImporting(true);
    const created = [];
    for (const row of valid) {
      const rec = await base44.entities.GuestList.create({
        event_id: event.id,
        event_title: event.title,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email?.toLowerCase() || "",
        phone: row.phone || "",
        guest_type: GUEST_TYPES.includes(row.guest_type) ? row.guest_type : "Custom",
        custom_label: !GUEST_TYPES.includes(row.guest_type) ? row.guest_type : (row.custom_label || ""),
        whose_guest: row.whose_guest || "",
        ticket_type: row.ticket_type || "General",
        allowed_count: row.allowed_count || 1,
        added_by_name: user?.full_name || user?.email || "Import",
        added_by_email: user?.email || "",
        source: "csv_import",
      }).catch(() => null);
      if (rec) created.push(rec);
    }
    setGuests(prev => [...prev, ...created]);
    setImportRows([]);
    setShowImport(false);
    setImporting(false);
    toast.success(`${created.length} guest${created.length !== 1 ? "s" : ""} imported successfully`);
  };

  const downloadTemplate = () => {
    const csv = "first_name,last_name,email,phone,guest_type,custom_label,allowed_count,whose_guest,ticket_type\nJohn,Doe,john@example.com,+1234567890,Artist Guest,,1,DJ Headliner,VIP\nJane,Smith,,+0987654321,VIP Guest,,2,Sponsor,GA\nMike,Jones,mike@example.com,,Custom,Sponsor Guest,1,,Backstage";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "guest-list-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) ||
      (g.email || "").toLowerCase().includes(q) ||
      (g.phone || "").includes(q);
    const matchType = filterType === "all" || g.guest_type === filterType;
    const matchStatus = filterStatus === "all" ||
      (filterStatus === "attended" && g.checked_in) ||
      (filterStatus === "pending" && !g.checked_in);
    return matchSearch && matchType && matchStatus;
  });

  // ── Analytics ─────────────────────────────────────────────────────────────
  const total = guests.length;
  const checkedIn = guests.filter(g => g.checked_in).length;

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> GUEST LIST
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {total} guest{total !== 1 ? "s" : ""} · {checkedIn} attended
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowAnalytics(v => !v)} className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Analytics
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowImport(v => !v); setShowForm(false); setImportRows([]); }} className="gap-1.5 text-xs border-accent/40 text-accent hover:bg-accent/10">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => { cancelForm(); setShowImport(false); setShowForm(v => !v); }} className="gap-1.5 text-xs glow-lime">
            <Plus className="w-3.5 h-3.5" /> Add Guest
          </Button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <h3 className="font-display font-bold text-sm">Guest List Analytics</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-secondary text-center">
              <p className="font-mono text-2xl font-black">{total}</p>
              <p className="text-[10px] font-mono text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-green-400/10 text-center">
              <p className="font-mono text-2xl font-black text-green-400">{checkedIn}</p>
              <p className="text-[10px] font-mono text-muted-foreground">Attended</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-400/10 text-center">
              <p className="font-mono text-2xl font-black text-yellow-400">{total - checkedIn}</p>
              <p className="text-[10px] font-mono text-muted-foreground">Pending</p>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">By Guest Type</p>
            {GUEST_TYPES.filter(t => t !== "Custom").map(type => {
              const count = guests.filter(g => g.guest_type === type).length;
              if (!count) return null;
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-28 truncate">{type}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          {total > 0 && (
            <p className="text-xs text-muted-foreground font-mono pt-1">
              Attendance rate: <span className="text-foreground font-bold">{Math.round((checkedIn / total) * 100)}%</span>
            </p>
          )}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm">{editingId ? "Edit Guest" : "Add Guest"}</h3>
            <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">First Name *</Label>
              <Input value={form.first_name}
                onChange={e => { setForm(f => ({ ...f, first_name: e.target.value })); setErrors(p => ({ ...p, first_name: "" })); }}
                placeholder="John"
                className={`mt-1 bg-secondary border-border/50 ${errors.first_name ? "border-destructive" : ""}`} />
              {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Last Name *</Label>
              <Input value={form.last_name}
                onChange={e => { setForm(f => ({ ...f, last_name: e.target.value })); setErrors(p => ({ ...p, last_name: "" })); }}
                placeholder="Doe"
                className={`mt-1 bg-secondary border-border/50 ${errors.last_name ? "border-destructive" : ""}`} />
              {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Email (optional)</Label>
              <Input value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(p => ({ ...p, email: "" })); }}
                placeholder="guest@email.com" type="email"
                className={`mt-1 bg-secondary border-border/50 ${errors.email ? "border-destructive" : ""}`} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Phone (optional)</Label>
              <Input value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 234 567 8900"
                className="mt-1 bg-secondary border-border/50" />
            </div>
          </div>

          {/* Guest Type */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Guest Type *</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GUEST_TYPES.map(type => (
                <button key={type} type="button"
                  onClick={() => setForm(f => ({ ...f, guest_type: type }))}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${
                    form.guest_type === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Label (shown when Custom is selected) */}
          {form.guest_type === "Custom" && (
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Custom Label *</Label>
              <Input value={form.custom_label}
                onChange={e => { setForm(f => ({ ...f, custom_label: e.target.value })); setErrors(p => ({ ...p, custom_label: "" })); }}
                placeholder='e.g. Sponsor Guest, DJ Team Guest, Backstage'
                className={`mt-1 bg-secondary border-border/50 ${errors.custom_label ? "border-destructive" : ""}`} />
              {errors.custom_label && <p className="text-xs text-destructive mt-1">{errors.custom_label}</p>}
            </div>
          )}

          {/* Whose Guest + Ticket Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Who's Guest</Label>
              <Input value={form.whose_guest}
                onChange={e => setForm(f => ({ ...f, whose_guest: e.target.value }))}
                placeholder="e.g. DJ Name, Sponsor"
                className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Ticket Type</Label>
              <Input value={form.ticket_type}
                onChange={e => setForm(f => ({ ...f, ticket_type: e.target.value }))}
                placeholder="e.g. GA, VIP, Backstage"
                className="mt-1 bg-secondary border-border/50" />
            </div>
          </div>

          {/* Allowed Count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Allowed Count</Label>
              <Input type="number" min={1} value={form.allowed_count}
                onChange={e => setForm(f => ({ ...f, allowed_count: e.target.value }))}
                className="mt-1 bg-secondary border-border/50" />
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">People this entry covers</p>
            </div>
            <div />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Notes (optional)</Label>
            <Input value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any special requirements..."
              className="mt-1 bg-secondary border-border/50" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold text-sm">
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add to List"}
            </Button>
            <Button variant="outline" onClick={cancelForm} className="text-sm">Cancel</Button>
          </div>
        </div>
      )}

      {/* CSV Import Panel */}
      {showImport && (
        <div className="p-4 rounded-xl bg-card border border-accent/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm">Import Guest List (CSV)</h3>
            <button onClick={() => { setShowImport(false); setImportRows([]); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Columns: <code className="bg-muted px-1 rounded">first_name, last_name, email, phone, guest_type, custom_label, allowed_count, whose_guest, ticket_type</code>
          </p>
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-accent/40 cursor-pointer hover:border-accent/70 transition-colors text-sm font-mono">
              <Upload className="w-4 h-4 text-accent" />
              Choose CSV File
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileImport} />
            </label>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-3.5 h-3.5" /> Download Template
            </button>
          </div>

          {/* Import Preview */}
          {importRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-muted-foreground">
                  {importRows.filter(r => !r._dup && !r._error).length} valid ·{" "}
                  <span className="text-yellow-400">{importRows.filter(r => r._dup).length} duplicate{importRows.filter(r => r._dup).length !== 1 ? "s" : ""}</span> ·{" "}
                  <span className="text-destructive">{importRows.filter(r => r._error).length} error{importRows.filter(r => r._error).length !== 1 ? "s" : ""}</span>
                </p>
                <button onClick={() => setImportRows([])} className="text-xs text-muted-foreground hover:text-foreground font-mono">Clear</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {importRows.map((row, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${
                    row._dup ? "border-yellow-400/30 bg-yellow-400/5" :
                    row._error ? "border-destructive/30 bg-destructive/5" :
                    "border-border/40 bg-card"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{row.first_name} {row.last_name}
                        {row.allowed_count > 1 && <span className="ml-1.5 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Allowed: {row.allowed_count}</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {row.whose_guest && <span className="text-[10px] font-mono text-muted-foreground">Guest of: {row.whose_guest}</span>}
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${TYPE_COLORS[row.guest_type] || "bg-muted text-muted-foreground"}`}>{row.guest_type === "Custom" ? row.custom_label : row.guest_type}</span>
                        <span className="text-[10px] font-mono bg-accent/10 text-accent px-1.5 py-0.5 rounded">{row.ticket_type || "General"}</span>
                      </div>
                    </div>
                    {row._dup && <span className="text-[10px] font-mono text-yellow-400 shrink-0">DUPLICATE</span>}
                    {row._error && <span className="text-[10px] font-mono text-destructive shrink-0">{row._error}</span>}
                    <button onClick={() => setImportRows(r => r.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleConfirmImport}
                disabled={importing || !importRows.filter(r => !r._dup && !r._error).length}
                className="glow-lime font-display font-bold gap-2 w-full"
              >
                {importing ? "Importing..." : `Import ${importRows.filter(r => !r._dup && !r._error).length} Guest${importRows.filter(r => !r._dup && !r._error).length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Search + Filter Bar */}
      {guests.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone..."
              className="pl-8 h-8 text-xs bg-card border-border/50" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="h-8 rounded-md border border-input bg-secondary text-foreground px-2 text-xs font-mono">
            <option value="all">All Types</option>
            {GUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-secondary text-foreground px-2 text-xs font-mono">
            <option value="all">All Status</option>
            <option value="attended">Attended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      )}

      {/* Guest List */}
      {guests.length === 0 ? (
        <div className="py-12 text-center bg-card rounded-xl border border-border/50">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No guests added yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add guests manually or import a CSV guest list.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center bg-card rounded-xl border border-border/50">
          <p className="text-sm text-muted-foreground">No guests match your search</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl bg-card border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/40">
                  <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Guest</th>
                  <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Who's Guest</th>
                  <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Type</th>
                  <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Check-In</th>
                  <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(guest => (
                  <tr key={guest.id} className={`border-b border-border/30 last:border-0 transition-colors ${guest.checked_in ? "bg-green-400/5" : ""}`}>
                    <td className="p-3">
                      <p className="font-medium">{guest.first_name} {guest.last_name}</p>
                      {guest.allowed_count > 1 && (
                        <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Allowed: {guest.allowed_count}</span>
                      )}
                      {(guest.email || guest.phone) && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{guest.email || guest.phone}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-muted-foreground">{guest.whose_guest || "—"}</p>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[10px] font-bold uppercase px-2 py-1 rounded bg-muted text-foreground border border-border/50">
                        {guest.ticket_type || "General"}
                      </span>
                    </td>
                    <td className="p-3">
                      {guest.checked_in ? (
                        <div>
                          <button
                            onClick={() => handleCheckIn(guest)}
                            className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase px-3 py-1.5 rounded bg-green-400/15 text-green-400 hover:bg-green-400/25 transition-all"
                            title={`Checked in ${guest.checked_in_at ? format(new Date(guest.checked_in_at), "h:mm a") : ""} by ${guest.checked_in_by || "?"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                          </button>
                          {guest.checked_in_at && (
                            <p className="text-[9px] font-mono text-muted-foreground mt-0.5 pl-0.5">
                              {format(new Date(guest.checked_in_at), "h:mm a")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(guest)}
                          className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-all">
                          <Circle className="w-3.5 h-3.5" /> Check In
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(guest)}
                          className="p-1.5 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(guest)}
                          className={`p-1.5 rounded transition-colors ${
                            guest.checked_in && user?.role !== "admin"
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          }`}
                          title={guest.checked_in && user?.role !== "admin" ? "Attended guests cannot be removed" : "Remove guest"}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length < guests.length && (
              <div className="px-3 py-2 border-t border-border/30 text-xs text-muted-foreground font-mono">
                Showing {filtered.length} of {guests.length} guests
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(guest => (
              <div key={guest.id} className={`p-3 rounded-xl border ${guest.checked_in ? "border-green-400/30 bg-green-400/5" : "border-border/50 bg-card"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{guest.first_name} {guest.last_name}</p>
                    {guest.allowed_count > 1 && (
                      <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Allowed: {guest.allowed_count}</span>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/50">
                        {guest.ticket_type || "General"}
                      </span>
                      {guest.whose_guest && (
                        <span className="text-[10px] font-mono text-muted-foreground">Guest of: {guest.whose_guest}</span>
                      )}
                    </div>
                    {(guest.email || guest.phone) && (
                      <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{guest.email || guest.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleEdit(guest)}
                      className="p-2 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(guest)}
                      className={`p-2 rounded transition-colors ${
                        guest.checked_in && user?.role !== "admin"
                          ? "text-muted-foreground/20 cursor-not-allowed"
                          : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      }`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5">
                  {guest.checked_in ? (
                    <button
                      onClick={() => handleCheckIn(guest)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs font-bold bg-green-400/15 text-green-400 hover:bg-green-400/25 transition-all">
                      <CheckCircle2 className="w-4 h-4" />
                      Checked In {guest.checked_in_at ? `· ${format(new Date(guest.checked_in_at), "h:mm a")}` : ""}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(guest)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-all">
                      <Circle className="w-4 h-4" /> Check In
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length < guests.length && (
              <p className="text-xs text-muted-foreground font-mono text-center pt-1">
                Showing {filtered.length} of {guests.length} guests
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}