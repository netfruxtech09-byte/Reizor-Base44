/**
 * MobileSelect — a `<select>` replacement that renders as a native select on
 * desktop and as a bottom-sheet Drawer on mobile (< lg breakpoint).
 *
 * Props mirror a basic HTML <select>:
 *   value, onChange, options: [{ value, label }], placeholder, disabled, className
 *
 * Usage:
 *   <MobileSelect
 *     value={status}
 *     onChange={v => setStatus(v)}
 *     options={[{ value: "active", label: "Active" }, { value: "hidden", label: "Hidden" }]}
 *     placeholder="Select status"
 *   />
 */
import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";

const MOBILE_BREAKPOINT = 1024; // matches lg:

function useIsMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export default function MobileSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  if (!isMobile) {
    // Desktop: plain native select
    return (
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm ${className}`}
      >
        {!value && <option value="" disabled>{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  // Mobile: trigger button + bottom-sheet
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm text-left touch-manipulation ${
          !value ? "text-muted-foreground" : "text-foreground"
        } ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle className="font-display text-base font-bold">{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-1 max-h-[60vh] overflow-y-auto">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation ${
                  o.value === value
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <span>{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}