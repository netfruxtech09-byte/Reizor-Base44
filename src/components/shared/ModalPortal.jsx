import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a modal overlay and content as a root-level portal directly under document.body.
 * Ensures the modal is fixed-positioned relative to the viewport, not the page.
 * 
 * Props:
 *   open (bool) - whether to show the portal
 *   children (ReactNode) - the modal content
 *   onBackdropClick (func) - called when backdrop is clicked (optional)
 *   zIndex (number) - z-index of the portal (default: 50)
 */
export default function ModalPortal({ open, children, onBackdropClick, zIndex = 50 }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock scroll only while portal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted || !open) return null;

  const portalContent = (
    <div 
      className="fixed z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ 
        inset: 0, 
        width: '100vw', 
        height: '100dvh',
        zIndex: zIndex
      }}
      onClick={onBackdropClick}
    >
      {children}
    </div>
  );

  return createPortal(portalContent, document.body);
}