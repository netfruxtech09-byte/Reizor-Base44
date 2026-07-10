import { useState } from "react";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DUE_OPTIONS = [
  { value: "on_booking", label: "On Booking (Deposit)" },
  { value: "pre_show_7", label: "7 Days Before Show" },
  { value: "pre_show_1", label: "Day Before Show" },
  { value: "day_of_show", label: "Day of Show" },
  { value: "post_show", label: "After Show" },
  { value: "custom_date", label: "Custom Date" },
];

export default function PaymentStructureEditor({ structure, onChange, totalFee, readOnly }) {
  const addRow = () => {
    onChange([...structure, { label: "Payment", amount: 0, due_when: "on_booking", due_date: "", status: "pending" }]);
  };

  const removeRow = (i) => onChange(structure.filter((_, idx) => idx !== i));

  const updateRow = (i, field, value) => {
    onChange(structure.map((row, idx) => idx === i ? { ...row, [field]: field === "amount" ? Number(value) : value } : row));
  };

  const total = structure.reduce((s, r) => s + (r.amount || 0), 0);
  const remaining = (totalFee || 0) - total;

  return (
    <div className="space-y-3">
      {structure.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-4">
            <Input
              value={row.label}
              onChange={e => updateRow(i, "label", e.target.value)}
              placeholder="Label (e.g. Deposit)"
              className="bg-secondary border-border/50 text-sm h-8"
              disabled={readOnly}
            />
          </div>
          <div className="col-span-2">
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                type="number"
                value={row.amount}
                onChange={e => updateRow(i, "amount", e.target.value)}
                className="bg-secondary border-border/50 text-sm h-8 pl-6"
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="col-span-4">
            <select
              value={row.due_when}
              onChange={e => updateRow(i, "due_when", e.target.value)}
              className="w-full h-8 rounded-md bg-secondary border border-border/50 px-2 text-xs"
              disabled={readOnly}
            >
              {DUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {row.due_when === "custom_date" && (
            <div className="col-span-11">
              <Input
                type="date"
                value={row.due_date || ""}
                onChange={e => updateRow(i, "due_date", e.target.value)}
                className="bg-secondary border-border/50 text-sm h-8"
                disabled={readOnly}
              />
            </div>
          )}
          {!readOnly && (
            <div className="col-span-2 flex justify-end">
              <button onClick={() => removeRow(i)} className="text-destructive hover:opacity-80">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <button onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add payment milestone
        </button>
      )}

      {structure.length > 0 && totalFee > 0 && (
        <div className={`flex items-center justify-between text-xs font-mono p-2 rounded-lg ${Math.abs(remaining) < 0.01 ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>
          <span>Total allocated: ${total.toFixed(2)} / ${totalFee.toFixed(2)}</span>
          {Math.abs(remaining) < 0.01 ? (
            <span>✓ Balanced</span>
          ) : (
            <span>⚠ ${Math.abs(remaining).toFixed(2)} {remaining > 0 ? "unallocated" : "over-allocated"}</span>
          )}
        </div>
      )}
    </div>
  );
}