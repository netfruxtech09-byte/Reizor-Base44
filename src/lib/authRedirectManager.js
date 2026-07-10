/**
 * Authentication Redirect Manager
 * 
 * Handles safe redirects to login/signup with intended destination tracking.
 * Ensures:
 * 1. Intended destination is preserved before redirecting to auth
 * 2. Login page is removed from browser history after successful auth
 * 3. Authenticated users never see the login screen on back-navigation
 * 4. Deep links and protected routes work correctly
 */

const AUTH_NEXT_URL_KEY = 'auth_next_url';
const AUTH_NEXT_URL_TIME_KEY = 'auth_next_url_time';
const MAX_REDIRECT_AGE_MS = 10 * 60 * 1000; // 10 minutes — old redirects are stale

/**
 * Save intended destination before redirecting to auth
 * @param {string} nextPath - The path the user intended to access
 */
export function saveAuthNextUrl(nextPath) {
  if (nextPath && nextPath !== '/' && nextPath.startsWith('/')) {
    const now = Date.now();
    sessionStorage.setItem(AUTH_NEXT_URL_KEY, nextPath);
    sessionStorage.setItem(AUTH_NEXT_URL_TIME_KEY, now.toString());
  }
}

/**
 * Retrieve and clear the saved intended destination
 * @returns {string|null} The saved next URL or null if expired/missing
 */
export function getAndClearAuthNextUrl() {
  const nextPath = sessionStorage.getItem(AUTH_NEXT_URL_KEY);
  const savedTime = sessionStorage.getItem(AUTH_NEXT_URL_TIME_KEY);
  
  // Clear immediately
  sessionStorage.removeItem(AUTH_NEXT_URL_KEY);
  sessionStorage.removeItem(AUTH_NEXT_URL_TIME_KEY);
  
  if (!nextPath) return null;
  
  // Check if redirect is stale (older than MAX_REDIRECT_AGE_MS)
  if (savedTime) {
    const age = Date.now() - parseInt(savedTime, 10);
    if (age > MAX_REDIRECT_AGE_MS) {
      return null; // too old, don't use it
    }
  }
  
  return nextPath;
}

/**
 * Check if user is trying to access auth routes while authenticated
 * If so, redirect them away from login/signup
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @param {string} currentPath - Current URL path
 * @returns {boolean} True if a redirect was performed
 */
export function guardAuthRoutes(isAuthenticated, currentPath) {
  // Only guard if user is authenticated and on an auth-related route
  if (!isAuthenticated) return false;
  
  const authRoutes = ['/artist/signup', '/organizer/signup'];
  const isOnAuthRoute = authRoutes.some(route => currentPath.startsWith(route));
  
  if (!isOnAuthRoute) return false;
  
  // Authenticated user on auth route — redirect to home or saved destination
  const nextPath = getAndClearAuthNextUrl();
  if (nextPath) {
    window.location.replace(nextPath);
  } else {
    window.location.replace('/');
  }
  
  return true;
}



/**
 * Get the redirect URL to use after auth
 * Priority: saved nextUrl > role-based dashboard > home
 * @param {object} user - Authenticated user object
 * @returns {string} The path to redirect to
 */
export function getPostAuthRedirect(user) {
  const nextPath = getAndClearAuthNextUrl();
  if (nextPath) return nextPath;
  
  // Role-based defaults
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'organizer') return '/organizer';
  if (user?.role === 'white_label') return '/agent-dashboard';
  if (user?.role === 'artist') return '/artist';
  
  // New user — redirect to profile onboarding
  const isNewUser = !user?.city && (!user?.preferred_genres || user.preferred_genres.length === 0);
  if (isNewUser) return '/profile?new=1';
  
  // Default to home
  return '/';
}