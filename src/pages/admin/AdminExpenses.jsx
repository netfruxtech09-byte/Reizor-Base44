import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Loader2, Receipt, Search, X, Pencil, Check, Tag, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HOLDER_TYPES = [
  { value: "platform", label: "Platform / Admin" },
  { value: "organizer", label: "Organizer" },
  { value: "artist", label: "Artist" },
  { value: "white_label", label: "White Label" },
];

const EXPENSE_CATEGORIES = [
  "Marketing", "Operations", "Venue", "Security", "Production",
  "Staffing", "Technology", "Legal", "Finance", "Travel", "Other"
];

const TYPE_COLORS = {
  platform: "bg-blue-400/10 text-blue-400",
  organizer: "bg-yellow-400/10 text-yellow-400",
  artist: "bg-primary/10 text-primary",
  white_label: "bg-accent/10 text-accent",
};

// ── Searchable selector ────────────────────────────────────────────────────
function SearchableSelector({ options, value, onChange, placeholder, loading }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o =>
    !query || (o.name || "").toLowerCase().includes(query.toLowerCase()) ||
    (o.email || "").toLowerCase().includes(query.toLowerCase())
  );
  const selected = options.find(o => o.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-left gap-2"
      >
        <span className={selected ? "text-foreground truncate" : "text-muted-foreground"}>
          {loading ? "Loading..." : selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ""}` : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md bg-card border border-border/60 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search..." className="w-full bg-secondary border border-border/50 rounded px-2 py-1 pl-7 text-sm outline-none" />
              {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3 h-3" /></button>}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onMouseDown={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              — Clear selection —
            </button>
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No results found</p>}
            {filtered.map(o => (
              <button key={o.id} type="button" onMouseDown={() => { onChange(o); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${value === o.id ? "bg-primary/10 text-primary" : ""}`}>
                <span className="font-medium">{o.name}</span>
                {o.email && <span className="text-xs text-muted-foreground ml-2">{o.email}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expense name autocomplete ──────────────────────────────────────────────
const SUGGESTIONS_KEY = "admin_expense_name_suggestions";
function loadSavedSuggestions() { try { return JSON.parse(localStorage.getItem(SUGGESTIONS_KEY) || "[]"); } catch { return []; } }
function saveSuggestion(name) {
  if (!name?.trim()) return;
  const updated = [name.trim(), ...loadSavedSuggestions().filter(s => s !== name.trim())].slice(0, 50);
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(updated));
}

function ExpenseNameInput({ value, onChange, suggestions }) {
  const [show, setShow] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);
  return (
    <div className="relative">
      <Input value={value} onChange={e => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)} onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder="e.g. Venue deposit, Marketing, Security..." />
      {show && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-0.5 rounded-md bg-card border border-border/60 shadow-lg overflow-hidden">
          {filtered.slice(0, 6).map(s => (
            <button key={s} type="button" onMouseDown={() => { onChange(s); setShow(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-mono">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Blank form state ───────────────────────────────────────────────────────
const BLANK = { holderType: "platform", selectedHolder: null, selectedEvent: null, expenseName: "", amount: "", notes: "", category: "", expenseDate: "" };

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [suggestions, setSuggestions] = useState(loadSavedSuggestions());
  const [saveError, setSaveError] = useState(null);

  // Form state
  const [holderType, setHolderType] = useState("platform");
  const [holders, setHolders] = useState([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  // Field touch tracking for validation
  const [touched, setTouched] = useState({ expenseName: false, amount: false, selectedHolder: false });

  useEffect(() => { loadExpenses(); }, []);

  useEffect(() => {
    // When switching holder type, clear related selections and reload holders
    // Do NOT clear selections when editing — the form is being pre-filled
    setSaveError(null);

    if (editingId) {
      // Edit mode: load holders for the dropdown but preserve the selected holder
      if (holderType !== "platform") loadHolders(holderType);
      return;
    }

    setSelectedHolder(null);
    setSelectedEvent(null);
    setEvents([]);

    if (holderType === "platform") {
      setHolders([]);
      return;
    }
    loadHolders(holderType);
  }, [holderType]);

  useEffect(() => {
    if (editingId) {
      // Edit mode: load events for dropdown but preserve the selected event
      if (selectedHolder && holderType !== "platform") loadEvents(holderType, selectedHolder);
      return;
    }
    if (!selectedHolder || holderType === "platform") { setEvents([]); setSelectedEvent(null); return; }
    loadEvents(holderType, selectedHolder);
  }, [selectedHolder]);

  const loadExpenses = async () => {
    setLoading(true);
    const data = await base44.entities.AdminExpense.list("-created_date", 500).catch(() => []);
    setExpenses(data);
    const names = [...new Set(data.map(e => e.expense_name).filter(Boolean))];
    setSuggestions(prev => [...new Set([...names, ...prev])].slice(0, 50));
    setLoading(false);
  };

  const loadHolders = async (type) => {
    setHoldersLoading(true);
    let list = [];
    if (type === "organizer") {
      const users = await base44.entities.User.list(null, 500).catch(() => []);
      list = users.filter(u => u.role === "organizer").map(u => ({ id: u.id, name: u.full_name || u.email, email: u.email }));
    } else if (type === "artist") {
      const artists = await base44.entities.Artist.filter({ approval_status: "approved" }, null, 200).catch(() => []);
      list = artists.map(a => ({ id: a.id, name: a.display_name, email: a.user_email }));
    } else if (type === "white_label") {
      const wls = await base44.entities.WhiteLabel.list(null, 200).catch(() => []);
      list = wls.map(w => ({ id: w.id, name: w.brand_name || w.name || w.id }));
    }
    setHolders(list);
    setHoldersLoading(false);
  };

  const loadEvents = async (type, holder) => {
    setEventsLoading(true);
    let eventList = [];
    if (type === "organizer") {
      eventList = await base44.entities.Event.filter({ organizer_id: holder.id }, null, 200).catch(() => []);
    } else if (type === "artist") {
      const all = await base44.entities.Event.list("-date", 500).catch(() => []);
      eventList = all.filter(e => (e.artists || []).includes(holder.id) || (e.artist_details || []).some(ad => ad.name === holder.name));
      if (eventList.length === 0) eventList = all.slice(0, 100);
    } else {
      eventList = await base44.entities.Event.list("-date", 200).catch(() => []);
    }
    setEvents(eventList);
    setEventsLoading(false);
  };

  const resetForm = () => {
    setHolderType("platform");
    setSelectedHolder(null);
    setSelectedEvent(null);
    setExpenseName("");
    setAmount("");
    setNotes("");
    setCategory("");
    setExpenseDate("");
    setEditingId(null);
    setSaveError(null);
    setTouched({ expenseName: false, amount: false, selectedHolder: false });
  };

  const startEdit = (exp) => {
    setEditingId(exp.id);
    setHolderType(exp.holder_type || "platform");
    setExpenseName(exp.expense_name || "");
    setAmount(String(exp.amount || ""));
    setNotes(exp.notes || "");
    setCategory(exp.category || "");
    setExpenseDate(exp.expense_date || "");
    // Restore holder/event — use {id, name} shape for SearchableSelector compatibility
    if (exp.holder_id && exp.holder_type && exp.holder_type !== "platform") {
      setSelectedHolder({ id: exp.holder_id, name: exp.holder_name || exp.holder_id, email: "" });
    } else {
      setSelectedHolder(null);
    }
    if (exp.event_id) {
      setSelectedEvent({ id: exp.event_id, name: exp.event_title || "", email: "" });
    } else {
      setSelectedEvent(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    // Validate required fields
    if (!expenseName.trim() || !amount || parseFloat(amount) <= 0) {
      setTouched({ expenseName: true, amount: true, selectedHolder: true });
      setSaveError("Please complete all required fields.");
      return;
    }
    if (holderType !== "platform" && !selectedHolder) {
      setTouched(prev => ({ ...prev, selectedHolder: true }));
      setSaveError("Please select a holder.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      // Build payload with required fields
      const payload = {
        holder_type: holderType,
        holder_name: holderType !== "platform" ? selectedHolder?.name : "Platform / Admin",
        expense_name: expenseName.trim(),
        amount: parseFloat(amount),
      };

      // Add holder_id: from selected holder for non-platform, null for platform
      payload.holder_id = holderType !== "platform" && selectedHolder?.id ? selectedHolder.id : null;

      // Add optional event fields only if selected
      if (selectedEvent?.id) {
        payload.event_id = selectedEvent.id;
      }
      if (selectedEvent?.title) {
        payload.event_title = selectedEvent.title;
      }

      // Add other optional fields only if they have values
      if (notes.trim()) {
        payload.notes = notes.trim();
      }
      if (category) {
        payload.category = category;
      }
      if (expenseDate) {
        payload.expense_date = expenseDate;
      }

      console.debug("[AdminExpenses] Saving with payload:", JSON.stringify(payload, null, 2));

      if (editingId) {
        await base44.entities.AdminExpense.update(editingId, payload);
        toast.success("Expense updated successfully.");
      } else {
        const created = await base44.entities.AdminExpense.create(payload);
        setExpenses(prev => [created, ...prev]);
        toast.success("Expense saved successfully.");
      }

      saveSuggestion(expenseName.trim());
      setSuggestions(loadSavedSuggestions());
      resetForm();
      loadExpenses();
    } catch (err) {
      console.error("[AdminExpenses] Save failed:", { error: err, payload: { holder_type: holderType, holder_name: holderType !== "platform" ? selectedHolder?.name : "Platform / Admin", expense_name: expenseName.trim(), amount: parseFloat(amount) } });
      setSaveError(err?.message || "Failed to save expense. Please check your entries and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await base44.entities.AdminExpense.delete(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
    setConfirmDeleteId(null);
    toast.success("Expense deleted");
  };

  const isPlatform = holderType === "platform";
  const isFormValid = expenseName.trim() && amount && parseFloat(amount) > 0 && (isPlatform || !!selectedHolder);
  const eventOptions = events.map(ev => ({ id: ev.id, name: ev.title, email: ev.date ? format(new Date(ev.date), "MMM d, yyyy") : "" }));

  // Field-level validation
  const nameError = touched.expenseName && !expenseName.trim() ? "Expense name is required." : null;
  const amountError = touched.amount && (!amount || parseFloat(amount) <= 0) ? "Valid amount is required." : null;
  const holderError = touched.selectedHolder && holderType !== "platform" && !selectedHolder ? "Please select a holder." : null;

  // Group totals for summary
  const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const platformTotal = expenses.filter(e => e.holder_type === "platform").reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">ADMIN EXPENSES</h1>
        <p className="text-sm text-muted-foreground mt-1">Add custom expenses that affect the Admin P&amp;L. Link to organizer, artist, white label, or leave as platform-only.</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg bg-card border border-border/40 px-4 py-2 text-center">
          <p className="text-[10px] font-mono text-muted-foreground uppercase">Total Expenses</p>
          <p className="font-display font-black text-lg text-destructive">-${totalAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-card border border-border/40 px-4 py-2 text-center">
          <p className="text-[10px] font-mono text-muted-foreground uppercase">Entries</p>
          <p className="font-display font-black text-lg">{expenses.length}</p>
        </div>
        <div className="rounded-lg bg-card border border-border/40 px-4 py-2 text-center">
          <p className="text-[10px] font-mono text-muted-foreground uppercase">Platform Only</p>
          <p className="font-display font-black text-lg text-blue-400">-${platformTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Add / Edit Form */}
      <div className="rounded-xl bg-card border border-border/50 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            {editingId ? <Pencil className="w-4 h-4 text-accent" /> : <Plus className="w-4 h-4 text-primary" />}
            {editingId ? "Edit Expense" : "Add Expense"}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Cancel Edit
            </button>
          )}
        </div>

        {/* Holder Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Related To</label>
          <div className="flex gap-2 flex-wrap">
            {HOLDER_TYPES.map(t => (
              <button key={t.value} onClick={() => setHolderType(t.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-mono font-bold transition-all ${
                  holderType === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {isPlatform && (
            <p className="text-[11px] font-mono text-muted-foreground">Platform expenses affect the admin P&amp;L directly, not linked to any organizer/artist.</p>
          )}
        </div>

        {/* Entity selector (only for non-platform) */}
        {!isPlatform && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {holderType === "artist" ? "Artist" : holderType === "white_label" ? "White Label" : "Organizer"}
            </label>
            {holdersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : (
              <>
                <SearchableSelector
                  options={holders}
                  value={selectedHolder?.id || ""}
                  onChange={(h) => {
                    setSelectedHolder(h);
                    setSelectedEvent(null);
                    setTouched(prev => ({ ...prev, selectedHolder: true }));
                  }}
                  placeholder={`Select ${holderType === "white_label" ? "White Label" : holderType === "artist" ? "Artist" : "Organizer"}`}
                />
                {holderError && <p className="text-xs text-destructive font-mono">{holderError}</p>}
              </>
            )}
          </div>
        )}

        {/* Event selector (optional for all types) */}
        {(!isPlatform && selectedHolder || isPlatform) && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Related Event <span className="text-muted-foreground/50 normal-case">(optional)</span>
            </label>
            {eventsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading events...</div>
            ) : isPlatform ? (
              // For platform expenses, show a simple text input for event reference (won't create event_id)
              <Input value={selectedEvent?.title || ""} onChange={e => setSelectedEvent(e.target.value ? { title: e.target.value } : null)}
                placeholder="Optional event name or reference..." />
            ) : (
              <SearchableSelector options={eventOptions} value={selectedEvent?.id || ""}
                onChange={(ev) => setSelectedEvent(ev ? events.find(e => e.id === ev.id) || null : null)}
                placeholder="Select Event (optional)" />
            )}
          </div>
        )}

        {/* Expense details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Expense Name *</label>
            <ExpenseNameInput value={expenseName} onChange={setExpenseName} suggestions={suggestions} />
            {nameError && <p className="text-xs text-destructive font-mono">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Amount ($) *</label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, amount: true }))}
            />
            {amountError && <p className="text-xs text-destructive font-mono">{amountError}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Category</label>
            <Select value={category || ""} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Expense Date</label>
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Notes (optional)</label>
            <Input placeholder="Internal admin notes..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          </div>

          {saveError && (
          <div className="rounded-lg bg-destructive/15 border-2 border-destructive p-3 space-y-1">
            <p className="text-xs font-mono font-bold text-destructive uppercase">Error</p>
            <p className="text-sm text-destructive">{saveError}</p>
          </div>
          )}

          <Button onClick={handleSave} disabled={!isFormValid || saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId ? "Update Expense" : "Save Expense"}
        </Button>
      </div>

      {/* Expense List */}
      <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-lg">All Admin Expenses</h2>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{expenses.length} entries · total: -${totalAmount.toFixed(2)}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : expenses.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No admin expenses added yet.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {expenses.map(exp => (
              <div key={exp.id} className={`flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-muted/20 transition-colors gap-3 ${editingId === exp.id ? "bg-accent/5 border-l-2 border-accent" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[exp.holder_type] || "bg-muted text-muted-foreground"}`}>
                      {exp.holder_type === "platform" ? "Platform" : exp.holder_type?.replace("_", " ")}
                    </span>
                    {exp.category && (
                      <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />{exp.category}
                      </span>
                    )}
                    <span className="text-sm font-bold">{exp.expense_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {exp.holder_type !== "platform" && exp.holder_name ? `${exp.holder_name}` : "Platform / Admin"}
                    {exp.event_title ? ` · ${exp.event_title}` : ""}
                    {exp.notes ? ` · ${exp.notes}` : ""}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                    {exp.expense_date
                      ? format(new Date(exp.expense_date + "T00:00:00"), "MMM d, yyyy")
                      : exp.created_date ? format(new Date(exp.created_date), "MMM d, yyyy") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                  <span className="font-mono font-bold text-destructive text-base whitespace-nowrap">-${(exp.amount || 0).toFixed(2)}</span>
                  <button onClick={() => startEdit(exp)} className="text-muted-foreground hover:text-accent transition-colors p-1" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(exp.id)} disabled={deleting === exp.id} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Delete">
                    {deleting === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-black">Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the expense entry and affect P&amp;L calculations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(confirmDeleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}