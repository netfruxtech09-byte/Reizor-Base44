/**
 * haptics.js — Native haptic feedback for iOS/Android.
 *
 * Capacitor v5/v6 exposes plugins via the global window.Capacitor.Plugins namespace
 * ONLY when the native build includes the plugin. This module handles all cases:
 *   1. Capacitor native iOS/Android — uses @capacitor/haptics via Plugins global
 *   2. Web/PWA — uses navigator.vibrate (Android Chrome, some WebViews)
 *   3. Desktop/unsupported — silently no-ops
 *
 * Pattern guide:
 *   light   — navigation taps, menu open/close
 *   medium  — button presses, selections, confirmations
 *   heavy   — destructive actions
 *   success — scan success, payment confirmed, RSVP approved
 *   error   — scan failed, validation error, payment failed
 *   warning — approaching limit, partial success
 */

/**
 * Returns true if running inside a Capacitor native shell (iOS or Android).
 * Works for Capacitor v3, v4, v5, and v6.
 */
const isCapacitor = () => {
  try {
    const cap = window.Capacitor;
    if (!cap) return false;
    // v5/v6: isNativePlatform() is a function
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    // v3/v4 fallback: isNative is a boolean
    if (typeof cap.isNative === "boolean") return cap.isNative;
    // Last resort: check platform
    return cap.getPlatform?.() !== "web";
  } catch {
    return false;
  }
};

/**
 * Resolves the Haptics plugin from the Capacitor global.
 * Capacitor v5/v6: window.Capacitor.Plugins.Haptics (registered at native bridge init)
 * Returns null if plugin is not available.
 */
function getHapticsPlugin() {
  try {
    const plugin = window?.Capacitor?.Plugins?.Haptics;
    if (plugin && typeof plugin.impact === "function") return plugin;
    return null;
  } catch {
    return null;
  }
}

/**
 * Trigger a Capacitor native haptic.
 * @returns {Promise<boolean>} true if the haptic fired successfully
 */
async function capacitorHaptic(type) {
  try {
    const Haptics = getHapticsPlugin();
    if (!Haptics) return false;

    // Impact styles — Capacitor accepts both uppercase and lowercase string values
    if (type === "light") {
      await Haptics.impact({ style: "Light" });
    } else if (type === "medium") {
      await Haptics.impact({ style: "Medium" });
    } else if (type === "heavy") {
      await Haptics.impact({ style: "Heavy" });
    } else if (type === "success") {
      await Haptics.notification({ type: "Success" });
    } else if (type === "error") {
      await Haptics.notification({ type: "Error" });
    } else if (type === "warning") {
      await Haptics.notification({ type: "Warning" });
    } else {
      await Haptics.impact({ style: "Medium" });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Web Vibration API fallback — works on Android Chrome and some WebViews.
 * iOS Safari does NOT support navigator.vibrate, so this is Android-only.
 */
function vibrate(pattern) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Main haptic trigger — call anywhere in the app.
 * @param {'light'|'medium'|'heavy'|'success'|'error'|'warning'} type
 */
export async function haptic(type = "medium") {
  // Capacitor native path (iOS + Android native builds)
  if (isCapacitor()) {
    const ok = await capacitorHaptic(type);
    if (ok) return;
    // If plugin fired but returned false, still try vibration as last resort
  }

  // Web Vibration API fallback
  const patterns = {
    light:   [30],
    medium:  [50],
    heavy:   [80],
    success: [30, 50, 30],
    error:   [80, 50, 80],
    warning: [50, 40, 50],
  };
  vibrate(patterns[type] ?? patterns.medium);
}

/** Convenience shortcuts — these are what components import */
export const hapticLight   = () => haptic("light");
export const hapticMedium  = () => haptic("medium");
export const hapticHeavy   = () => haptic("heavy");
export const hapticSuccess = () => haptic("success");
export const hapticError   = () => haptic("error");
export const hapticWarning = () => haptic("warning");