import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44, markAppInitialized } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import AuthRequiredModal from '@/components/auth/AuthRequiredModal';
import { queryClientInstance } from '@/lib/query-client';
import { saveAuthNextUrl, getAndClearAuthNextUrl, getPostAuthRedirect } from '@/lib/authRedirectManager';

const AuthContext = createContext();

// ── Global singleton ──────────────────────────────────────────────────────────
// One stable setter — registered once, never torn down mid-session.
// The `_modalShowing` flag prevents duplicate triggers from concurrent 401s.
let _setModalOpen = null;
let _modalShowing = false;

export function showGlobalAuthModal() {
  if (_modalShowing) return; // already open — don't stack
  if (_setModalOpen) {
    _modalShowing = true;
    _setModalOpen(true);
  }
}

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // isAuthReady: true only after the auth check has fully resolved (success or guest).
  // useAuthGate checks this before showing the modal to avoid firing during page load.
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [postAuthNavDone, setPostAuthNavDone] = useState(false);
  const [globalAuthModalOpen, setGlobalAuthModalOpen] = useState(false);
  const authNavigateRef = useRef(navigate);

  // Keep navigate ref in sync (in case navigate reference changes)
  useEffect(() => {
    authNavigateRef.current = navigate;
  }, [navigate]);

  // Register the global setter once on mount — never re-register to avoid gaps
  useEffect(() => {
    _setModalOpen = (val) => setGlobalAuthModalOpen(val);
    return () => {
      // Only clear on full unmount (app shutdown), not re-renders
      _setModalOpen = null;
      _modalShowing = false;
    };
  }, []); // empty deps — intentional, register once

  useEffect(() => {
    checkAppState();
  }, []);

  const handleModalClose = () => {
    _modalShowing = false;
    setGlobalAuthModalOpen(false);
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      // Re-read token before launching — appParams is frozen at module load
      const liveToken = localStorage.getItem('base44_access_token') || appParams.token;

      // Run public settings + auth check IN PARALLEL — don't block one on the other
      const [publicSettingsResult] = await Promise.allSettled([
        appClient.get(`/prod/public-settings/by-id/${appParams.appId}`),
        liveToken ? checkUserAuth() : Promise.resolve(null),
      ]);

      if (publicSettingsResult.status === 'fulfilled') {
        setAppPublicSettings(publicSettingsResult.value);
      } else {
        const appError = publicSettingsResult.reason;
        if (appError?.status === 403 && appError?.data?.extra_data?.reason === 'user_not_registered') {
          setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
        } else if (appError?.status !== 401 && appError?.status !== 403) {
          setAuthError({ type: 'unknown', message: appError?.message || 'Failed to load app' });
        }
      }

      // If no token, mark auth as done (guest)
      if (!liveToken) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setIsAuthReady(true);
      }

      setIsLoadingPublicSettings(false);
      markAppInitialized();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setIsAuthReady(true);
      markAppInitialized();
    }
  };

  const checkUserAuth = async () => {
   try {
     setIsLoadingAuth(true);
     const currentUser = await base44.auth.me();

     if (!currentUser.auth_provider) {
       try {
         await base44.auth.updateMe({ auth_provider: 'email' });
         currentUser.auth_provider = 'email';
       } catch {}
     }

     console.log('[🔐 AUTH] Auth check successful:', { email: currentUser.email, role: currentUser.role });
     console.log('[🔐 AUTH] Current URL:', window.location.pathname + window.location.search);

     // Determine post-auth destination BEFORE setting state
     const savedNextUrl = getAndClearAuthNextUrl();
     let finalDestination = null;

     if (savedNextUrl) {
       console.log('[🔐 AUTH] Using saved auth_next_url:', savedNextUrl);
       finalDestination = savedNextUrl;
     } else if (window.location.pathname === '/' && !sessionStorage.getItem('pending_checkout') && !sessionStorage.getItem('pending_table_checkout')) {
       // Auto-redirect to role-based dashboard only on first landing at "/"
       console.log('[🔐 AUTH] Determining role-based destination...');
       if (currentUser.role === 'admin') {
         finalDestination = '/admin';
       } else if (currentUser.role === 'organizer') {
         finalDestination = '/organizer';
       } else if (currentUser.role === 'white_label' || currentUser.role === 'sub_white_label') {
          finalDestination = '/agent-dashboard';
       } else if (
         // New fan/user: no location and no genre preferences set yet
         (!currentUser.role || currentUser.role === 'user') &&
         !currentUser.city &&
         (!currentUser.preferred_genres || currentUser.preferred_genres.length === 0)
       ) {
         console.log('[🔐 AUTH] New user detected (no city, no genres) → /profile?new=1');
         finalDestination = '/profile?new=1';
       } else if (!currentUser.role || currentUser.role === 'user') {
         // Returning fan/user — do NOT auto-route to WL dashboard based on stale localStorage.
         // WL users should navigate directly to /agent-dashboard or be invited via a link.
         // No redirect needed for regular users.
       }
     }

     // Store destination for use in effect
     if (finalDestination) {
       console.log('[🔐 AUTH] Storing post_auth_destination:', finalDestination);
       sessionStorage.setItem('post_auth_destination', finalDestination);
     } else {
       console.log('[🔐 AUTH] No post-auth redirect needed (staying on current page)');
     }

     setUser(currentUser);
     setIsAuthenticated(true);
     setIsLoadingAuth(false);
     setIsAuthReady(true); // auth check complete — user is logged in
   } catch (error) {
     // Auth check failed — user is a guest. This is normal for public pages.
     console.log('[🔐 AUTH] Auth check failed:', error.message);
     setIsLoadingAuth(false);
     setIsAuthenticated(false);
     setIsAuthReady(true); // auth check complete — user is a guest (not an error)
   }
  };

  // Mark post-auth navigation as complete for guests (no redirect needed)
  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) setPostAuthNavDone(true);
  }, [isAuthReady, isAuthenticated]);

  // Separate effect to handle post-auth navigation AFTER auth state is set
  useEffect(() => {
    if (!isAuthenticated) return; // Only run if authenticated

    const destination = sessionStorage.getItem('post_auth_destination');
    if (!destination) { setPostAuthNavDone(true); return; } // Nothing to do

    sessionStorage.removeItem('post_auth_destination'); // Clear immediately

    console.log('[🔐 AUTH] ========== POST-AUTH NAVIGATION SEQUENCE START ==========');
    console.log('[🔐 AUTH] Current URL:', window.location.pathname + window.location.search);
    console.log('[🔐 AUTH] Final destination:', destination);
    console.log('[🔐 AUTH] Current history length:', window.history.length);

    // Step 1: Replace current entry with Home
    console.log('[🔐 AUTH] STEP 1: Calling navigate("/", { replace: true })');
    authNavigateRef.current('/', { replace: true });

    // Step 2: After Home is set, push final destination
    // Need a small delay to ensure router processes the replace before the push
    const timer = setTimeout(() => {
      console.log('[🔐 AUTH] STEP 2: After 100ms delay, calling navigate(destination, { replace: false })');
      console.log('[🔐 AUTH] Destination:', destination);
      console.log('[🔐 AUTH] Current URL before push:', window.location.pathname + window.location.search);
      console.log('[🔐 AUTH] Current history length before push:', window.history.length);
      authNavigateRef.current(destination, { replace: false });
      console.log('[🔐 AUTH] Current URL after push:', window.location.pathname + window.location.search);
      console.log('[🔐 AUTH] Current history length after push:', window.history.length);
      console.log('[🔐 AUTH] ========== POST-AUTH NAVIGATION SEQUENCE COMPLETE ==========');
      setPostAuthNavDone(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const logout = () => {
    // Clear React state first — this prevents auth modal from firing during redirect
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    // Reset the global modal flag so it doesn't re-fire right after logout
    _modalShowing = true; // suppress any modal triggers during logout navigation
    // Clear any Base44 token from localStorage so next load starts clean
    try {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('base44_token');
    localStorage.removeItem('token');
    localStorage.removeItem('wl_id'); // clear WL session — prevent identity bleed on next login
    sessionStorage.clear();
      // Clear React Query cache so stale data doesn't leak to the next session
      queryClientInstance.clear();
      // Unregister service workers so they don't serve stale cached pages after logout
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => reg.unregister());
        });
      }
      // Clear all caches to prevent stale app shell being served on next load
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
      }
    } catch {}
    // Single hard redirect — SDK logout handles server-side session, then we force fresh load
    base44.auth.logout('/');
  };

  const navigateToLogin = (nextPath = '/') => {
    // Store intended destination before redirecting to login
    saveAuthNextUrl(nextPath);
    base44.auth.redirectToLogin(nextPath);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isAuthReady,
      postAuthNavDone,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      showAuthModal: showGlobalAuthModal,
    }}>
      <AuthRequiredModal
        open={globalAuthModalOpen}
        onClose={handleModalClose}
        message="Please sign in or create an account to continue."
      />
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};