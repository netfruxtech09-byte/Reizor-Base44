import { Trash2, X, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sticky bulk-action bar shown when 1+ records are selected.
 * Props:
 *  - selectedCount: number
 *  - totalCount: number
 *  - onSelectAll: fn
 *  - onClearSelection: fn
 *  - onDeleteSelected: fn
 *  - deleteLabel: string (optional)
 */
export default function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  deleteLabel = "Delete Selected",
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-xl bg-card border border-primary/40 shadow-lg shadow-primary/10 ring-1 ring-primary/20">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono font-bold text-sm text-primary">
          {selectedCount} selected
        </span>
        {selectedCount < totalCount && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Select all {totalCount}
          </button>
        )}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear selection
        </button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onDeleteSelected}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {deleteLabel}
      </Button>
    </div>
  );
}