import { useState, useEffect } from "react";
import { Plus, Trash2, Save, DollarSign, TrendingDown, TrendingUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * EntryRow with autocomplete suggestions from previously used names.
 * suggestions: array of { label, amount } objects
 */
function EntryRow({ entry, onChange, onRemove, suggestions = [] }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filtered = suggestions.filter(
    (s) => s.label.toLowerCase().includes(entry.name.toLowerCase()) && s.label !== entry.name
  );

  const handleSelect = (s) => {
    onChange({ ...entry, name: s.label, amount: s.amount != null ? String(s.amount) : entry.amount });
    setShowSuggestions(false);
  };

  return (
     <div className="flex items-start gap-2 relative flex-nowrap overflow-x-auto">
       <div className="flex-1 min-w-0 relative">
        <Input
          value={entry.name}
          onChange={(e) => { onChange({ ...entry, name: e.target.value }); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Name / description"
          className="bg-secondary border-border/50 text-sm h-9"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-0.5 rounded-md bg-card border border-border/60 shadow-lg overflow-hidden">
            {filtered.slice(0, 6).map((s) => (
              <button
                key={s.label}
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3"
              >
                <span className="font-mono">{s.label}</span>
                {s.amount != null && (
                  <span className="font-mono text-xs text-muted-foreground shrink-0">${s.amount}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input
        type="number"
        value={entry.amount}
        onChange={(e) => onChange({ ...entry, amount: e.target.value })}
        placeholder="Amount ($)"
        className="w-32 bg-secondary border-border/50 text-sm h-9"
      />
      <button
        onClick={onRemove}
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function EventFinancialsManager({ event }) {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenseSuggestions, setExpenseSuggestions] = useState([]);
  const [incomeSuggestions, setIncomeSuggestions] = useState([]);

  // Track which saved records to delete on save
  const [savedExpenses, setSavedExpenses] = useState([]);
  const [savedIncomes, setSavedIncomes] = useState([]);
  // Track existing label records so we don't duplicate
  const [savedLabelIds, setSavedLabelIds] = useState([]);

  const organizerId = event.organizer_id;

  useEffect(() => {
    Promise.all([
      base44.entities.EventExpense.filter({ event_id: event.id }, "created_date", 100).catch(() => []),
      base44.entities.EventIncome.filter({ event_id: event.id }, "created_date", 100).catch(() => []),
      // Load this organizer's saved labels from DB
      base44.entities.OrganizerFinancialLabel.filter({ organizer_id: organizerId }, "created_date", 200).catch(() => []),
      // Also load ALL past expenses/incomes for this organizer to seed suggestions from history
      base44.entities.EventExpense.filter({ organizer_id: organizerId }, "created_date", 500).catch(() => []),
      base44.entities.EventIncome.filter({ organizer_id: organizerId }, "created_date", 500).catch(() => []),
    ]).then(async ([exps, incs, labels, allExps, allIncs]) => {
      setSavedExpenses(exps);
      setSavedIncomes(incs);
      setExpenses(exps.map(e => ({ id: e.id, name: e.expense_name, amount: String(e.amount) })));
      setIncomes(incs.map(i => ({ id: i.id, name: i.income_name, amount: String(i.amount) })));

      const savedLabelList = labels.map(l => ({ id: l.id, label: l.label, label_type: l.label_type, amount: l.amount }));
      setSavedLabelIds(savedLabelList);

      // Build label→amount map from DB labels (most recent wins, already sorted by created_date)
      const expenseLabelMap = new Map(); // label -> { id, amount }
      const incomeLabelMap = new Map();
      labels.forEach(l => {
        if (l.label_type === "expense") expenseLabelMap.set(l.label, { id: l.id, amount: l.amount });
        if (l.label_type === "income") incomeLabelMap.set(l.label, { id: l.id, amount: l.amount });
      });

      // Pull unique names+amounts from all past events for this organizer (history seeding)
      // allExps/allIncs are sorted by created_date asc, so later entries overwrite earlier for same label
      const histExpenseMap = new Map();
      allExps.forEach(e => { if (e.expense_name?.trim()) histExpenseMap.set(e.expense_name.trim(), e.amount); });
      const histIncomeMap = new Map();
      allIncs.forEach(i => { if (i.income_name?.trim()) histIncomeMap.set(i.income_name.trim(), i.amount); });

      // Seed missing labels into DB (fire and forget)
      const toCreate = [];
      histExpenseMap.forEach((amount, label) => {
        if (!expenseLabelMap.has(label)) toCreate.push({ organizer_id: organizerId, label, label_type: "expense", amount });
      });
      histIncomeMap.forEach((amount, label) => {
        if (!incomeLabelMap.has(label)) toCreate.push({ organizer_id: organizerId, label, label_type: "income", amount });
      });
      if (toCreate.length > 0) {
        Promise.all(toCreate.map(l => base44.entities.OrganizerFinancialLabel.create(l).catch(() => null)));
      }

      // Merge DB labels + history into suggestion arrays of { label, amount }
      const mergedExpense = new Map([...histExpenseMap, ...expenseLabelMap].map(([label, val]) =>
        [label, { label, amount: typeof val === "object" ? val.amount : val }]
      ));
      const mergedIncome = new Map([...histIncomeMap, ...incomeLabelMap].map(([label, val]) =>
        [label, { label, amount: typeof val === "object" ? val.amount : val }]
      ));

      setExpenseSuggestions([...mergedExpense.values()]);
      setIncomeSuggestions([...mergedIncome.values()]);

      setLoading(false);
    });
  }, [event.id, organizerId]);

  // Persist labels+amounts to DB (organizer-specific)
  // Creates new labels or updates existing ones if amount changed
  const persistNewLabels = async (entries, labelType) => {
    const ops = entries
      .map(e => ({ label: e.name.trim(), amount: parseFloat(e.amount) || 0 }))
      .filter(e => e.label);

    await Promise.all(ops.map(async ({ label, amount }) => {
      const existing = savedLabelIds.find(l => l.label_type === labelType && l.label === label);
      if (existing) {
        // Update amount if it changed
        if (existing.amount !== amount) {
          await base44.entities.OrganizerFinancialLabel.update(existing.id, { amount }).catch(() => null);
          setSavedLabelIds(prev => prev.map(l => l.id === existing.id ? { ...l, amount } : l));
        }
      } else {
        // Create new label
        const created = await base44.entities.OrganizerFinancialLabel.create({
          organizer_id: organizerId, label, label_type: labelType, amount
        }).catch(() => null);
        if (created) {
          setSavedLabelIds(prev => [...prev, { id: created.id, label, label_type: labelType, amount }]);
        }
      }
    }));

    // Refresh suggestions state
    setSavedLabelIds(prev => {
      const map = new Map(prev.filter(l => l.label_type === labelType).map(l => [l.label, l]));
      ops.forEach(({ label, amount }) => {
        const ex = map.get(label);
        if (ex) map.set(label, { ...ex, amount });
      });
      const updated = [...map.values()].map(l => ({ label: l.label, amount: l.amount }));
      if (labelType === "expense") setExpenseSuggestions(updated);
      if (labelType === "income") setIncomeSuggestions(updated);
      return prev;
    });
  };

  const addExpense = () => setExpenses(prev => [...prev, { id: null, name: "", amount: "" }]);
  const addIncome = () => setIncomes(prev => [...prev, { id: null, name: "", amount: "" }]);

  const validate = (entries, nameKey) => {
    for (const e of entries) {
      if (!e.name.trim()) { toast.error(`${nameKey} name cannot be blank`); return false; }
      const amt = parseFloat(e.amount);
      if (isNaN(amt) || amt < 0) { toast.error(`Amount must be a valid positive number`); return false; }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate(expenses, "Expense") || !validate(incomes, "Income")) return;
    setSaving(true);

    // Persist labels + amounts to DB (organizer-specific)
    await persistNewLabels(expenses, "expense");
    await persistNewLabels(incomes, "income");

    // Delete all existing saved records then re-create (simplest safe approach)
    await Promise.all([
      ...savedExpenses.map(e => base44.entities.EventExpense.delete(e.id).catch(() => {})),
      ...savedIncomes.map(i => base44.entities.EventIncome.delete(i.id).catch(() => {})),
    ]);

    const [newExps, newIncs] = await Promise.all([
      Promise.all(expenses.map(e =>
        base44.entities.EventExpense.create({
          event_id: event.id,
          event_title: event.title,
          organizer_id: event.organizer_id,
          expense_name: e.name.trim(),
          amount: parseFloat(e.amount),
        })
      )),
      Promise.all(incomes.map(i =>
        base44.entities.EventIncome.create({
          event_id: event.id,
          event_title: event.title,
          organizer_id: event.organizer_id,
          income_name: i.name.trim(),
          amount: parseFloat(i.amount),
        })
      )),
    ]);

    setSavedExpenses(newExps);
    setSavedIncomes(newIncs);
    setExpenses(newExps.map(e => ({ id: e.id, name: e.expense_name, amount: String(e.amount) })));
    setIncomes(newIncs.map(i => ({ id: i.id, name: i.income_name, amount: String(i.amount) })));

    setSaving(false);
    toast.success("Financials saved!");
  };

  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalIncome = incomes.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-nowrap overflow-x-auto">
         <div className="min-w-0 flex-1">
           <h2 className="font-display font-bold text-lg sm:text-base flex items-center gap-2 whitespace-nowrap">
             <DollarSign className="w-4 h-4 text-primary shrink-0" /> <span>EVENT FINANCIALS</span>
           </h2>
           <p className="text-xs text-muted-foreground font-mono mt-0.5 hidden sm:block">Manually track expenses and additional income for this event</p>
         </div>
         <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 glow-lime font-display font-bold shrink-0 whitespace-nowrap">
           <Save className="w-3.5 h-3.5" />
           <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
           <span className="inline sm:hidden">{saving ? "..." : "✓"}</span>
         </Button>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <h3 className="font-display font-bold text-sm">EXPENSES</h3>
            </div>
            {totalExpenses > 0 && (
              <span className="font-mono text-sm font-bold text-destructive">-${totalExpenses.toFixed(2)}</span>
            )}
          </div>

          <div className="space-y-2">
            {expenses.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No expenses added yet</p>
            )}
            {expenses.map((exp, i) => (
              <EntryRow
                key={i}
                entry={exp}
                suggestions={expenseSuggestions}
                onChange={(updated) => setExpenses(prev => prev.map((e, idx) => idx === i ? updated : e))}
                onRemove={() => setExpenses(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <Button size="sm" onClick={addExpense} className="w-full gap-2 bg-primary text-white hover:bg-primary/90 font-semibold transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </Button>

          <p className="text-[10px] text-muted-foreground font-mono">e.g. Venue cost, DJ payment, Security, Decoration</p>
        </div>

        {/* Other Income */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h3 className="font-display font-bold text-sm">OTHER INCOME</h3>
            </div>
            {totalIncome > 0 && (
              <span className="font-mono text-sm font-bold text-green-400">+${totalIncome.toFixed(2)}</span>
            )}
          </div>

          <div className="space-y-2">
            {incomes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No other income added yet</p>
            )}
            {incomes.map((inc, i) => (
              <EntryRow
                key={i}
                entry={inc}
                suggestions={incomeSuggestions}
                onChange={(updated) => setIncomes(prev => prev.map((e, idx) => idx === i ? updated : e))}
                onRemove={() => setIncomes(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <Button size="sm" onClick={addIncome} className="w-full gap-2 bg-primary text-white hover:bg-primary/90 font-semibold transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Income
          </Button>

          <p className="text-[10px] text-muted-foreground font-mono">e.g. Sponsor payment, Vendor fee, Merchandise, Donations</p>
        </div>
      </div>

      {/* Totals Summary */}
      {(expenses.length > 0 || incomes.length > 0) && (
        <div className="p-4 rounded-xl bg-secondary/50 border border-border/30 space-y-2">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Other Income</span>
            <span className="font-mono font-bold text-green-400">+${totalIncome.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-mono font-bold text-destructive">-${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-border/30 pt-2">
            <span className="text-sm">Net (this section)</span>
            <span className={`font-mono ${(totalIncome - totalExpenses) >= 0 ? "text-accent" : "text-destructive"}`}>
              {(totalIncome - totalExpenses) >= 0 ? "+" : ""}${(totalIncome - totalExpenses).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}