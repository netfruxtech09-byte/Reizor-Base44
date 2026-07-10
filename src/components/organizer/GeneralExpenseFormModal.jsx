import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function GeneralExpenseFormModal({ open, onClose, onSaved, organizerId, organizerName, expense, suggestions = [] }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialName = expense?.expense_name || "";
    setName(initialName);
    setAmount(expense ? String(expense.amount ?? "") : "");
    setDate(expense?.expense_date || new Date().toISOString().slice(0, 10));
    setCategory(expense?.category || "");
    setNotes(expense?.notes || "");
    // Reflect the actual saved-suggestion state for this expense name, not just local state
    setSaveForFuture(!!suggestions.find((s) => s.label === initialName));
    setShowSuggestions(false);
  }, [open, expense]);

  const filteredSuggestions = suggestions.filter(
    (s) => s.label.toLowerCase().includes(name.toLowerCase()) && s.label !== name
  );

  const handleSelectSuggestion = (s) => {
    setName(s.label);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Expense name is required");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return toast.error("Amount must be a valid positive number");
    if (!date) return toast.error("Expense date is required");

    setSaving(true);
    try {
      const payload = {
        holder_type: "organizer",
        holder_id: organizerId,
        holder_name: organizerName,
        event_id: null,
        event_title: null,
        expense_name: name.trim(),
        amount: amt,
        expense_date: date,
        category: category.trim() || null,
        notes: notes.trim() || null,
      };

      if (expense?.id) {
        await base44.entities.Expense.update(expense.id, payload);
      } else {
        await base44.entities.Expense.create(payload);
      }

      const trimmedName = name.trim();
      const originalName = expense?.expense_name || "";
      const existingForOriginal = originalName ? suggestions.find((s) => s.label === originalName) : null;
      const existingForNew = suggestions.find((s) => s.label === trimmedName);

      if (saveForFuture) {
        // If name changed and an old suggestion exists under the previous name, remove it to avoid duplicates
        if (existingForOriginal && originalName !== trimmedName) {
          await base44.entities.OrganizerFinancialLabel.delete(existingForOriginal.id).catch(() => null);
        }
        if (!existingForNew) {
          await base44.entities.OrganizerFinancialLabel.create({
            organizer_id: organizerId,
            label: trimmedName,
            label_type: "general_expense",
          }).catch(() => null);
        }
      } else {
        // Unchecked — remove any saved suggestion matching this expense (current or original name)
        if (existingForNew) {
          await base44.entities.OrganizerFinancialLabel.delete(existingForNew.id).catch(() => null);
        }
        if (existingForOriginal && existingForOriginal.label !== trimmedName) {
          await base44.entities.OrganizerFinancialLabel.delete(existingForOriginal.id).catch(() => null);
        }
      }

      toast.success(expense?.id ? "General expense updated" : "General expense added");
      onSaved();
    } catch (error) {
      toast.error("Failed to save expense");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-lg">
            {expense?.id ? "Edit General Expense" : "Add General Expense"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Expense Name *</label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. Giveaway merchandise, Marketing"
              className="bg-secondary border-border/50"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-0.5 rounded-md bg-card border border-border/60 shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredSuggestions.slice(0, 8).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onMouseDown={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-mono"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Amount ($) *</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-secondary border-border/50" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Date *</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border/50" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Marketing, Travel, Equipment" className="bg-secondary border-border/50" />
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="bg-secondary border-border/50" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={saveForFuture} onChange={(e) => setSaveForFuture(e.target.checked)} className="accent-primary" />
            Save "{name.trim() || "this name"}" for future use
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="flex-1 glow-lime font-display font-bold">
              {saving ? "Saving..." : expense?.id ? "Save Changes" : "Add Expense"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}