import React, { useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "react-router-dom";
import { showGlobalAuthModal } from "@/lib/AuthContext";
import { saveAuthNextUrl } from "@/lib/authRedirectManager";

/**
 * useAuthGate — reads isAuthenticated + isAuthReady from React context.
 *
 * IMPORTANT: The modal is only shown when isAuthReady=true (auth check has
 * fully resolved). During app boot / page load / background fetches, isAuthReady
 * is false, so requireAuth returns false silently without opening the modal.
 * This prevents the dialog from appearing on page load or refresh.
 *
 * The modal should only appear on direct, user-initiated protected actions
 * (Buy Ticket, Host Event, RSVP, Join Raffle, etc.).
 * 
 * After authentication, the user is redirected to the intended destination,
 * and the login page is removed from navigation history to prevent back-navigation loops.
 */
export function useAuthGate() {
  const { isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();

  const requireAuth = useCallback(
    (_message) => {
      // Not ready yet (app still booting) — return false silently, never show modal
      if (!isAuthReady) return Promise.resolve(false);
      if (!isAuthenticated) {
        // Store intended destination before showing modal
        const nextUrl = location.pathname + location.search;
        saveAuthNextUrl(nextUrl);
        showGlobalAuthModal();
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    },
    [isAuthenticated, isAuthReady, location.pathname, location.search]
  );

  const guardedAction = useCallback(
    (fn, _message) =>
      async (...args) => {
        if (!isAuthReady) return; // still booting — do nothing
        if (!isAuthenticated) {
          // Store intended destination before showing modal
          const nextUrl = location.pathname + location.search;
          saveAuthNextUrl(nextUrl);
          showGlobalAuthModal();
          return;
        }
        return fn(...args);
      },
    [isAuthenticated, isAuthReady, location.pathname, location.search]
  );

  return { requireAuth, guardedAction };
}