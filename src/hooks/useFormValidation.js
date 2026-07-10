import { useState, useCallback } from 'react';

/**
 * useFormValidation — validates form fields against rules before submission.
 *
 * Usage:
 *   const { errors, validate, clearError } = useFormValidation({
 *     title: { required: true, label: 'Title' },
 *     price: { required: true, numeric: true, min: 0, label: 'Price' },
 *     date:  { required: true, futureDate: true, label: 'Date' },
 *   });
 *
 *   const ok = validate(formData);  // returns true if all valid
 */
export function useFormValidation(rules) {
  const [errors, setErrors] = useState({});

  const validate = useCallback((data) => {
    const newErrors = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      const label = rule.label || field;

      if (rule.required && (value === undefined || value === null || value === '')) {
        newErrors[field] = `${label} is required.`;
        continue;
      }

      if (value === '' || value === undefined || value === null) continue;

      if (rule.numeric && isNaN(Number(value))) {
        newErrors[field] = `${label} must be a valid number.`;
        continue;
      }

      if (rule.min !== undefined && Number(value) < rule.min) {
        newErrors[field] = `${label} must be at least ${rule.min}.`;
        continue;
      }

      if (rule.max !== undefined && Number(value) > rule.max) {
        newErrors[field] = `${label} must be at most ${rule.max}.`;
        continue;
      }

      if (rule.futureDate) {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          newErrors[field] = `${label} must be a valid date.`;
          continue;
        }
        if (d < new Date()) {
          newErrors[field] = `${label} must be in the future.`;
          continue;
        }
      }

      if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field] = `${label} must be a valid email.`;
        continue;
      }

      if (rule.minLength && String(value).length < rule.minLength) {
        newErrors[field] = `${label} must be at least ${rule.minLength} characters.`;
        continue;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rules]);

  const clearError = useCallback((field) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll };
}