import { useState } from "react";
import { Zap, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESET_BUDGETS = [5, 10, 25, 50];

export default function VideoBudgetButton({ videoId, videoBudget, onBudgetUpdate, disabled }) {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState(videoBudget || "");

  const handlePreset = async (amount) => {
    if (onBudgetUpdate) {
      await onBudgetUpdate(videoId, amount);
    }
    setOpen(false);
  };

  const handleCustom = async () => {
    const amount = parseFloat(customAmount);
    if (amount > 0) {
      if (onBudgetUpdate) {
        await onBudgetUpdate(videoId, amount);
      }
      setOpen(false);
    }
  };

  const handleRemove = async () => {
    if (onBudgetUpdate) {
      await onBudgetUpdate(videoId, 0);
    }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-colors text-xs font-mono font-bold text-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Zap className="w-3 h-3" />
        {videoBudget ? `$${videoBudget}` : "Set Budget"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Set Video Budget
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground font-mono">
              Set a spending limit for this video's storage and bandwidth usage.
            </p>

            {/* Preset buttons */}
            <div className="grid grid-cols-2 gap-2">
              {PRESET_BUDGETS.map(amount => (
                <button
                  key={amount}
                  onClick={() => handlePreset(amount)}
                  className={`py-2 px-3 rounded-lg border font-mono font-bold text-sm transition-all ${
                    videoBudget === amount
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-secondary border-border/40 text-foreground hover:border-border/60"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Custom Amount (USD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="bg-secondary border-border/50"
                />
                <Button
                  onClick={handleCustom}
                  disabled={!customAmount || parseFloat(customAmount) <= 0}
                  size="sm"
                  className="gap-1 font-bold"
                >
                  <Check className="w-3 h-3" /> Set
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} size="sm" className="flex-1">
                Cancel
              </Button>
              {videoBudget > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                >
                  <X className="w-3 h-3" /> Remove Budget
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}