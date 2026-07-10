import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onKeyDown, onPaste, min, ...props }, ref) => {
  const isNumber = type === 'number';

  const handleKeyDown = (e) => {
    // Block invalid characters for number inputs
    if (isNumber && ['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e) => {
    if (isNumber) {
      const pasted = e.clipboardData.getData('text');
      if (!/^\d*\.?\d*$/.test(pasted)) {
        e.preventDefault();
      }
    }
    onPaste?.(e);
  };

  const resolvedMin = min;

  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-white/25 bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-40 md:text-sm hover:border-white/40 focus:border-primary",
        className
      )}
      ref={ref}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      min={resolvedMin}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }