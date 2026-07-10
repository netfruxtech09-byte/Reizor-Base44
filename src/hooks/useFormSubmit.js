import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * useFormSubmit — prevents double submissions, handles loading + error feedback.
 *
 * Usage:
 *   const { submitting, handleSubmit } = useFormSubmit();
 *   <Button disabled={submitting} onClick={() => handleSubmit(async () => { ... })}>
 *     {submitting ? 'Saving...' : 'Save'}
 *   </Button>
 */
export function useFormSubmit({ onSuccess, onError, successMessage } = {}) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (fn) => {
    if (submitting) return; // prevent double submission
    setSubmitting(true);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      onSuccess?.();
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      toast.error(msg);
      onError?.(err);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, onSuccess, onError, successMessage]);

  return { submitting, handleSubmit };
}