import { useState, useEffect, useMemo } from "react";
import { Plus, Wallet2, Search, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import GeneralExpenseFormModal from "@/components/organizer/GeneralExpenseFormModal";

export default function OrganizerGeneralExpenses() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = async (organizerId) => {
    const [exps, labels] = await Promise.all([
      base44.entities.Expense.filter({ holder_type: "organizer", holder_id: organizerId }, "-expense_date", 1000).catch(() => []),
      base44.entities.OrganizerFinancialLabel.filter({ organizer_id: organizerId, label_type: "general_expense" }, "-created_date", 200).catch(() => []),
    ]);
    setExpenses(exps);
    setSuggestions(labels.map((l) => ({ id: l.id, label: l.label })));
  };

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      await loadData(u.id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaved = async () => {
    setShowForm(false);
    setEditingExpense(null);
    await loadData(user.id);
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete "${expense.expense_name}"?`)) return;
    await base44.entities.Expense.delete(expense.id).catch(() => toast.error("Failed to delete"));
    await loadData(user.id);
  };

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        const matches = e.expense_name?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (dateFrom && e.expense_date && e.expense_date < dateFrom) return false;
      if (dateTo && e.expense_date && e.expense_date > dateTo) return false;
      return true;
    });
  }, [expenses, search, dateFrom, dateTo]);

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const hasActiveFilters = search || dateFrom || dateTo;
  const resetFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <Wallet2 className="w-7 h-7 text-primary" /> GENERAL EXPENSES
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Costs not tied to a specific event — merch, marketing, travel, and more</p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setShowForm(true); }} className="gap-2 glow-lime font-display font-bold shrink-0">
          <Plus className="w-4 h-4" /> Add General Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, category, notes..." className="pl-9 bg-secondary border-border/50" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-secondary border-border/50 w-full sm:w-36" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-secondary border-border/50 w-full sm:w-36" />
          {hasActiveFilters && (
            <Button variant="outline" onClick={resetFilters} className="gap-1.5 shrink-0" title="Reset filters">
              <X className="w-4 h-4" /> <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between">
        <span className="font-mono text-xs text-destructive uppercase tracking-widest">Total ({filtered.length} {filtered.length === 1 ? "expense" : "expenses"})</span>
        <span className="font-mono font-bold text-destructive text-xl">${total.toFixed(2)}</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-card border border-border/50">
          <Wallet2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {expenses.length === 0 ? "No general expenses added yet." : "No expenses match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className="p-3.5 rounded-xl bg-card border border-border/50 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{e.expense_name}</p>
                  {e.category && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{e.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-mono">
                  <span>{e.expense_date ? format(new Date(e.expense_date), "MMM d, yyyy") : "No date"}</span>
                  {e.notes && <span className="truncate">• {e.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <p className="font-mono font-bold text-destructive">${(e.amount || 0).toFixed(2)}</p>
                <button onClick={() => { setEditingExpense(e); setShowForm(true); }} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(e)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GeneralExpenseFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingExpense(null); }}
        onSaved={handleSaved}
        organizerId={user.id}
        organizerName={user.full_name || user.email}
        expense={editingExpense}
        suggestions={suggestions}
      />
    </div>
  );
}