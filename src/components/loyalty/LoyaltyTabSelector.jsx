import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dropdown for switching Loyalty tabs on all screen sizes (replaces the tab bar)
export default function LoyaltyTabSelector({ value, onValueChange, options }) {
  const active = options.find(o => o.value === value);
  return (
    <div className="w-full sm:w-72">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-card border-border/50">
          <SelectValue>
            {active && (
              <span className="flex items-center gap-2">
                <active.icon className="w-3.5 h-3.5 shrink-0" /> {active.label}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex items-center gap-2">
                <opt.icon className="w-3.5 h-3.5 shrink-0" /> {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}