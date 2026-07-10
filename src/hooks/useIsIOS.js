import { useMemo } from "react";

/**
 * Reliable iOS environment detection (iPhone, iPad, iPadOS).
 * iPadOS 13+ reports as "Mac OS X" with touch support, so we check
 * both the classic iOS UA strings and the Mac+touch combo.
 *
 * Used to gate features that must not appear in the Apple App Store build
 * (e.g. external payment CTAs restricted by App Store Guideline 3.1.1).
 */
export function detectIsIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Mac OS X/.test(ua) && (navigator.maxTouchPoints || 0) > 1)
  );
}

export default function useIsIOS() {
  return useMemo(() => detectIsIOS(), []);
}