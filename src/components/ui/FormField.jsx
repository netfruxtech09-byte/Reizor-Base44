import { cn } from '@/lib/utils';

/**
 * FormField — wraps a label, input, and validation error message.
 *
 * Usage:
 *   <FormField label="Price" error={errors.price} required>
 *     <Input type="number" ... />
 *   </FormField>
 */
export default function FormField({ label, error, required, children, className, hint }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground font-mono">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive font-mono flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}