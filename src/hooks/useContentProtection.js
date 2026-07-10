import { useEffect } from 'react';

const EDITABLE_SELECTORS = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  '[contenteditable]',
  '[contenteditable="true"]',
  '.ql-editor',
  '.ql-container',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]',
];

function isEditableTarget(el) {
  if (!el) return false;
  // e.target can be a text node (e.g. selectstart) — walk up to the parent element
  if (el.nodeType === Node.TEXT_NODE) {
    el = el.parentElement;
    if (!el) return false;
  }
  if (typeof el.closest !== 'function') return false;
  return EDITABLE_SELECTORS.some(sel => el.closest(sel));
}

export function useContentProtection() {
  useEffect(() => {
    const handleCopy = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleCut = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleContextMenu = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleDragStart = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleSelectStart = (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      if (isEditableTarget(e.target)) return;
      const isMac = navigator.platform?.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;
      const key = e.key.toLowerCase();
      // Block copy, cut, save, view-source
      if (['c', 'x', 's', 'u'].includes(key)) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}