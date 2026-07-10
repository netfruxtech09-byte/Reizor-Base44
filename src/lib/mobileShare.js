/**
 * mobileShare.js
 * Robust share and download utilities for iOS / Android WebView + browser.
 *
 * Priority chain for mobile:
 *  1. Capacitor Share plugin (Android APK / iOS app with Capacitor)
 *  2. Web Share API — navigator.share  (browser tabs, iOS WKWebView)
 *  3. Blob URL anchor click            (Android WebView fallback)
 *  4. Clipboard                        (last resort)
 *
 * Debug toasts show which method was attempted/used.
 */

import { toast } from "sonner";

/* ── Device detection ─────────────────────────────────────────── */

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent || "");
export const isAndroid = () => /Android/.test(navigator.userAgent || "");

export const isMobileWebView = () => {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) return true;
  if (/Android/.test(ua) && (/\bwv\)/.test(ua) || /; wv/.test(ua))) return true;
  if (/Capacitor/.test(ua)) return true;
  return false;
};

/**
 * Diagnose and log the current share capability.
 * Call this on app load to see what's available in the console/debug logs.
 */
export function diagnoseShareCapabilities() {
  const cap = {
    navigator_share: !!navigator?.share,
    navigator_canShare: !!navigator?.canShare,
    capacitor: isCapacitor(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isMobileWebView: isMobileWebView(),
    ua: (navigator.userAgent || "").slice(0, 200),
  };
  console.log("[mobileShare] Share capabilities:", cap);
  return cap;
}

export const isAndroidWebView = () => isAndroid() && isMobileWebView();
export const isIOSWebView = () => isIOS() && isMobileWebView();
export const isOnMobile = () => isIOS() || isAndroid();

/** True if running inside a Capacitor native app shell */
const isCapacitor = () =>
  typeof window !== "undefined" &&
  !!(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNative);

const hasNativeShare = () => !!navigator?.share;

/* ── Debug helper ─────────────────────────────────────────────── */

function debugLog(label, extra = "") {
  const ua = (navigator.userAgent || "").slice(0, 120);
  const hasShare = !!navigator?.share;
  const hasCanShare = !!navigator?.canShare;
  const cap = isCapacitor();
  console.log(
    `[mobileShare] ${label}`,
    extra,
    `| UA: ${ua} | navigator.share: ${hasShare} | canShare: ${hasCanShare} | Capacitor: ${cap}`
  );
  // Show a brief debug toast so it's visible during testing
  toast.info(`[Share] method: ${label}`, { duration: 3000 });
}

/* ── Capacitor Share plugin bridge ────────────────────────────── */

/**
 * Try the Capacitor Share plugin.
 * Works for text/URL sharing. Returns true on success.
 */
async function capacitorShare({ title = "", text = "", url = "", dialogTitle = "" } = {}) {
  try {
    const Share = window.Capacitor?.Plugins?.Share;
    if (!Share) return false;
    await Share.share({ title, text, url, dialogTitle: dialogTitle || title });
    debugLog("capacitor_share_text");
    return true;
  } catch (e) {
    if (e?.errorMessage?.includes("cancel") || e?.message?.includes("cancel")) return "cancelled";
    console.warn("[mobileShare] Capacitor share failed:", e);
    return false;
  }
}

/**
 * Try the Capacitor Filesystem + Share plugins to share a file (CSV/image/PDF).
 * Falls back gracefully if plugins are not available.
 */
async function capacitorShareFile(blob, fileName, mimeType, title = "") {
  try {
    const Share = window.Capacitor?.Plugins?.Share;
    const Filesystem = window.Capacitor?.Plugins?.Filesystem;
    // Directory.Cache = "CACHE" in Capacitor v4+
    const Directory = window.Capacitor?.Plugins?.Filesystem ? { Cache: "CACHE" } : null;

    if (!Share || !Filesystem || !Directory) return false;

    // Convert blob to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Write to temp file in cache directory
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title,
      url: uriResult.uri,
      dialogTitle: title || fileName,
    });

    debugLog("capacitor_share_file");
    return true;
  } catch (e) {
    if (e?.errorMessage?.includes("cancel") || e?.message?.includes("cancel")) return "cancelled";
    console.warn("[mobileShare] Capacitor file share failed:", e);
    return false;
  }
}

/* ── Android Intent share ─────────────────────────────────────── */

/**
 * Try Android Intent URL to open the native share sheet.
 * Works in Android WebView even without Capacitor or navigator.share.
 * Only for text/URL — cannot attach binary files this way.
 * Returns true if the intent URL was fired (no way to confirm user action).
 */
function androidIntentShare(textOrUrl, title = "") {
  if (!isAndroid()) return false;
  try {
    const encoded = encodeURIComponent(textOrUrl);
    const intentUrl =
      `intent:#Intent;action=android.intent.action.SEND;` +
      `type=text/plain;` +
      `S.android.intent.extra.TEXT=${encoded};` +
      (title ? `S.android.intent.extra.SUBJECT=${encodeURIComponent(title)};` : "") +
      `end`;
    // Use a hidden anchor click — location.href can be blocked in some WebViews
    const a = document.createElement("a");
    a.href = intentUrl;
    a.style.cssText = "position:fixed;top:-9999px;left:-9999px;pointer-events:none;";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    debugLog("android_intent");
    return true;
  } catch (e) {
    console.warn("[mobileShare] Android Intent share failed:", e);
    return false;
  }
}

/* ── Clipboard helper ─────────────────────────────────────────── */

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ── Share functions ──────────────────────────────────────────── */

export async function safeShare({ title = "", text = "", url = "" } = {}) {
  debugLog("safeShare_start", `title=${title}`);

  // 1. Capacitor Share plugin (Android APK / iOS app)
  if (isCapacitor()) {
    const result = await capacitorShare({ title, text, url });
    if (result === true) return { success: true, method: "capacitor_share" };
    if (result === "cancelled") return { success: false, reason: "aborted" };
  }

  // 2. Web Share API
  if (hasNativeShare()) {
    try {
      await navigator.share({ title, text, url });
      debugLog("native_share");
      return { success: true, method: "native" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 3. Android Intent share sheet
  if (isAndroid()) {
    const shareText = [text, url].filter(Boolean).join("\n");
    if (androidIntentShare(shareText, title)) return { success: true, method: "android_intent" };
  }

  // 4. Clipboard
  const copyContent = [text, url].filter(Boolean).join("\n");
  const copied = await copyText(copyContent);
  if (copied) {
    debugLog("clipboard_fallback");
    if (isAndroid()) {
      toast.info("Native share not available in this app view. Link copied to clipboard.", { duration: 4000 });
    } else {
      toast.info("Link copied to clipboard.");
    }
    return { success: true, method: "clipboard" };
  }

  window.prompt("Copy this link:", url || copyContent);
  return { success: true, method: "prompt" };
}

export async function safeShareWithImage({
  title = "",
  text = "",
  url = "",
  imageDataUrl,
  fileName = "share.png",
} = {}) {
  debugLog("safeShareWithImage_start");

  // 1. Capacitor file share
  if (isCapacitor() && imageDataUrl) {
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const result = await capacitorShareFile(blob, fileName, "image/png", title);
      if (result === true) return { success: true, method: "capacitor_share_file" };
      if (result === "cancelled") return { success: false, reason: "aborted" };
    } catch {}

    // Capacitor text share fallback
    const result = await capacitorShare({ title, text, url });
    if (result === true) return { success: true, method: "capacitor_share" };
    if (result === "cancelled") return { success: false, reason: "aborted" };
  }

  // 2. Web Share API with file
  if (imageDataUrl && hasNativeShare() && navigator.canShare) {
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, url, files: [file] });
        debugLog("native_file");
        return { success: true, method: "native_file" };
      }
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 3. Web Share API text-only
  if (hasNativeShare()) {
    try {
      await navigator.share({ title, text, url });
      debugLog("native_text");
      return { success: true, method: "native_text" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 4. Android Intent share sheet
  if (isAndroid()) {
    const shareText = [text, url].filter(Boolean).join("\n");
    if (androidIntentShare(shareText, title)) return { success: true, method: "android_intent" };
  }

  // 5. Clipboard
  const copyContent = [text, url].filter(Boolean).join("\n");
  const copied = await copyText(copyContent);
  if (copied) {
    debugLog("clipboard_fallback");
    toast.info("Unable to open share options. Link copied instead.");
    return { success: true, method: "clipboard" };
  }

  window.prompt("Copy this link:", url || text);
  return { success: true, method: "prompt" };
}

/* ── Download functions ───────────────────────────────────────── */

export async function safeDownloadImage(dataUrl, fileName = "download.png", shareOpts = {}) {
  const onMobile = isOnMobile();
  debugLog("safeDownloadImage_start", `mobile=${onMobile} cap=${isCapacitor()}`);

  // Desktop: anchor download
  if (!onMobile) {
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloaded successfully!");
      return { success: true, method: "anchor" };
    } catch {
      toast.error("Download failed. Please try again.");
      return { success: false };
    }
  }

  // Fetch blob
  let blob = null;
  let file = null;
  try {
    const res = await fetch(dataUrl);
    blob = await res.blob();
    file = new File([blob], fileName, { type: blob.type || "image/png" });
  } catch {}

  // 1. Capacitor file share
  if (isCapacitor() && blob) {
    const result = await capacitorShareFile(blob, fileName, blob.type || "image/png", shareOpts.title || "Save Image");
    if (result === true) return { success: true, method: "capacitor_share_file" };
    if (result === "cancelled") return { success: false, reason: "aborted" };
    // If Capacitor plugin failed, try Capacitor URL share
    if (shareOpts.url) {
      const r2 = await capacitorShare({ title: shareOpts.title || fileName, url: shareOpts.url });
      if (r2 === true) return { success: true, method: "capacitor_share_url" };
    }
  }

  // 2. Web Share API with file
  if (file && hasNativeShare() && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareOpts.title || "Save Image",
          text: shareOpts.text || "Save or share this image",
          files: [file],
          ...(shareOpts.url ? { url: shareOpts.url } : {}),
        });
        debugLog("native_file");
        return { success: true, method: "native_file" };
      }
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 3. Web Share API URL-only
  if (hasNativeShare() && shareOpts.url) {
    try {
      await navigator.share({
        title: shareOpts.title || fileName,
        text: shareOpts.text || "Save or share",
        url: shareOpts.url,
      });
      debugLog("native_url");
      return { success: true, method: "native_url" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 4. Android blob anchor
  if (isAndroid() && blob) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      debugLog("android_anchor");
      toast.success("File downloaded!");
      return { success: true, method: "android_anchor" };
    } catch {}
  }

  // 5. Android Intent share sheet (share the URL if available, else hint)
  if (isAndroid() && shareOpts.url) {
    if (androidIntentShare(shareOpts.url, shareOpts.title || fileName)) {
      return { success: true, method: "android_intent" };
    }
  }

  // 6. New tab with save hint
  const hint = isIOS()
    ? "Tap the share icon → Save Image or Save to Files."
    : "Long-press the image → Save image / Download image.";
  const opened = _openDataUrlTab(dataUrl, hint);
  if (opened) return { success: true, method: "newtab" };

  // 7. Clipboard last resort
  if (shareOpts.url) {
    const copied = await copyText(shareOpts.url);
    if (copied) {
      debugLog("clipboard_fallback");
      toast.info("Unable to save file directly. Link copied to clipboard.");
      return { success: false, method: "clipboard_fallback" };
    }
  }

  toast.error("Unable to save file. Please use Share or open in browser.");
  return { success: false };
}

export async function safeExportCSV(csvString, fileName = "export.csv") {
  const blob = new Blob([csvString], { type: "text/csv" });
  debugLog("safeExportCSV_start", `mobile=${isOnMobile()} cap=${isCapacitor()}`);

  // Desktop: anchor download
  if (!isOnMobile()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast.success("Exported successfully!");
    return { success: true, method: "anchor" };
  }

  // 1. Capacitor file share (Android APK / iOS app)
  if (isCapacitor()) {
    const result = await capacitorShareFile(blob, fileName, "text/csv", fileName);
    if (result === true) return { success: true, method: "capacitor_share_file" };
    if (result === "cancelled") return { success: false, reason: "aborted" };
    // If file share failed, try Capacitor blob URL share
    try {
      const blobUrl = URL.createObjectURL(blob);
      const r2 = await capacitorShare({ title: fileName, url: blobUrl, dialogTitle: `Share ${fileName}` });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      if (r2 === true) return { success: true, method: "capacitor_share_url" };
    } catch {}
  }

  // 2. Web Share API with file
  const file = new File([blob], fileName, { type: "text/csv" });
  if (hasNativeShare() && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: fileName, files: [file] });
        debugLog("native_file");
        return { success: true, method: "native_file" };
      }
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 3. Web Share API with blob URL
  if (hasNativeShare()) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      await navigator.share({ title: fileName, url: blobUrl });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      debugLog("native_url");
      return { success: true, method: "native_url" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 4. Android blob anchor click
  if (isAndroid()) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      debugLog("android_anchor");
      toast.success("File downloaded!");
      return { success: true, method: "android_anchor" };
    } catch {}
  }

  // 5. Android Intent share sheet (share a blob URL — opens share sheet in some WebViews)
  if (isAndroid()) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const fired = androidIntentShare(blobUrl, fileName);
      // Note: blob URLs may not be accessible cross-process on all Android WebViews.
      // If it opens but fails to load, the user will at least see the share sheet.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      if (fired) return { success: true, method: "android_intent" };
    } catch {}
  }

  // 6. Clipboard last resort
  const copied = await copyText(csvString.slice(0, 2000));
  if (copied) {
    debugLog("clipboard_fallback");
    toast.info("Unable to open share options. Data copied to clipboard instead.");
    return { success: false, method: "clipboard_fallback" };
  }

  toast.error("Export failed. Please try on a desktop browser.");
  return { success: false };
}

export async function safeDownloadUrl(url, fileName = "download", shareOpts = {}) {
  debugLog("safeDownloadUrl_start", `mobile=${isOnMobile()} cap=${isCapacitor()}`);

  // Desktop: anchor download
  if (!isOnMobile()) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Downloaded successfully!");
      return { success: true };
    } catch {
      window.open(url, "_blank");
      return { success: true };
    }
  }

  // Fetch blob for mobile share
  let blob = null;
  try {
    const res = await fetch(url);
    blob = await res.blob();
  } catch {}

  // 1. Capacitor file share
  if (isCapacitor() && blob) {
    const result = await capacitorShareFile(blob, fileName, blob.type, shareOpts.title || fileName);
    if (result === true) return { success: true, method: "capacitor_share_file" };
    if (result === "cancelled") return { success: false, reason: "aborted" };
    // Fallback: Capacitor URL share
    const r2 = await capacitorShare({ title: shareOpts.title || fileName, url });
    if (r2 === true) return { success: true, method: "capacitor_share_url" };
    if (r2 === "cancelled") return { success: false, reason: "aborted" };
  }

  // 2. Web Share API with file
  if (blob && hasNativeShare() && navigator.canShare?.({ files: [new File([blob], fileName, { type: blob.type })] })) {
    try {
      await navigator.share({ title: shareOpts.title || fileName, files: [new File([blob], fileName, { type: blob.type })] });
      debugLog("native_file");
      return { success: true, method: "native_file" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 3. Web Share API URL-only
  if (hasNativeShare()) {
    try {
      await navigator.share({ title: shareOpts.title || fileName, url });
      debugLog("native_url");
      return { success: true, method: "native_url" };
    } catch (e) {
      if (e.name === "AbortError") return { success: false, reason: "aborted" };
    }
  }

  // 4. Blob URL anchor (Android WebView)
  if (blob) {
    try {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      debugLog("android_anchor");
      toast.success("File downloaded!");
      return { success: true, method: "android_anchor" };
    } catch {}
  }

  // 5. Android Intent share sheet
  if (isAndroid()) {
    if (androidIntentShare(url, shareOpts.title || fileName)) {
      return { success: true, method: "android_intent" };
    }
  }

  // 6. Open URL in new tab
  window.open(url, "_blank");
  toast.success("Opening file…");
  return { success: true, method: "open" };
}

/** Open a data URL in a new tab with a save hint overlay. */
function _openDataUrlTab(dataUrl, hint) {
  try {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(
        `<!DOCTYPE html><html><head>` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Save Image</title>` +
        `<style>` +
        `body{margin:0;background:#0d1024;display:flex;flex-direction:column;` +
        `align-items:center;min-height:100vh;padding:16px;box-sizing:border-box}` +
        `img{max-width:100%;border-radius:12px;display:block}` +
        `p{color:#fff;font-family:monospace;font-size:13px;text-align:center;` +
        `margin-top:16px;padding:0 16px;opacity:0.8;line-height:1.5}` +
        `</style></head><body>` +
        `<img src="${dataUrl}" />` +
        `<p>${hint}</p>` +
        `</body></html>`
      );
      return true;
    }
  } catch {}
  return false;
}