import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, showGlobalAuthModal } from "@/lib/AuthContext";
import { saveAuthNextUrl } from "@/lib/authRedirectManager";

const ORG_ROLES = ["organizer", "manager", "admin"];

/**
 * useOrganizerAccess — role guard for Organizer-only CTAs/links.
 *
 * `requestAccess(targetPath)`:
 *  - Guest (not logged in): opens the auth modal (after auth, lands on target).
 *  - Organizer / manager / admin: navigates to targetPath.
 *  - Fan / other roles: opens the OrganizerAccessRequiredModal instead —
 *    NEVER auto-converts the account and never creates a stale "host" mode.
 *
 * Returns `{ requestAccess, showModal, setShowModal }`.
 * Render <OrganizerAccessRequiredModal open={showModal} onClose={() => setShowModal(false)} />
 * wherever the hook is used.
 */
export function useOrganizerAccess() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const requestAccess = useCallback(
    (targetPath = "/organizer") => {
      if (!isAuthReady) return; // still booting — ignore
      if (!user) {
        saveAuthNextUrl(targetPath);
        showGlobalAuthModal();
        return;
      }
      if (ORG_ROLES.includes(user.role)) {
        navigate(targetPath);
        return;
      }
      // Fan / any non-organizer role — show the access-required modal
      setShowModal(true);
    },
    [user, isAuthReady, navigate]
  );

  return { requestAccess, showModal, setShowModal };
}