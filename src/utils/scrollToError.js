/**
 * scrollToFirstError
 *
 * After validation, call this to scroll the page to the first errored field
 * and focus it. Works on both mobile and desktop, with a sticky-header offset.
 *
 * Usage:
 *   scrollToFirstError(errorsObject)
 *
 * Each key in errorsObject should match either:
 *   - An element with id="field-<key>"          → wraps the label + input
 *   - An element with data-field="<key>"         → alternate selector
 *   - An input/select/textarea with name="<key>" → direct focus
 */
export function scrollToFirstError(errors) {
  if (!errors || Object.keys(errors).length === 0) return;

  const firstKey = Object.keys(errors)[0];

  // Priority order for finding the element
  const el =
    document.getElementById(`field-${firstKey}`) ||
    document.querySelector(`[data-field="${firstKey}"]`) ||
    document.querySelector(`[name="${firstKey}"]`) ||
    document.querySelector(`#${firstKey}`);

  if (!el) return;

  // Sticky header height offset — 80px covers the organizer layout header + a gap
  const OFFSET = 96;

  const top = el.getBoundingClientRect().top + window.pageYOffset - OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

  // Focus the first focusable input inside the wrapper (or the element itself)
  setTimeout(() => {
    const focusable = el.querySelector("input, select, textarea") || el;
    if (focusable && typeof focusable.focus === "function") {
      focusable.focus({ preventScroll: true });
    }
  }, 350); // wait for smooth scroll to finish
}