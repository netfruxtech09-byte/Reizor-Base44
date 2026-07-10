/**
 * googleTranslate.js — Centralised Google Translate helper.
 *
 * Key design goals:
 *  1. GT script loaded once via index.html — never re-injected.
 *  2. waitForCombo() waits until the combo has options (truly ready), not just present.
 *  3. fireCombo() uses the native HTMLSelectElement setter so React/GT internals both see the change.
 *  4. applyLanguageWithRetry() verifies the value actually changed and retries up to 3x.
 *  5. Reload guard only blocks looping — it does NOT skip re-applying the saved language after reload.
 *  6. English reset clears all cookies and reloads once if the widget isn't ready.
 */

const STORAGE_KEY = "reizor_lang_v2";
const RELOAD_FLAG  = "reizor_gt_reloading"; // sessionStorage — consumed after ONE reload

const GT_CODE_MAP = {
  en:      "en",
  hi:      "hi",
  ur:      "ur",
  pa:      "pa",
  bn:      "bn",
  ta:      "ta",
  te:      "te",
  gu:      "gu",
  mr:      "mr",
  ne:      "ne",
  si:      "si",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ja:      "ja",
  ko:      "ko",
  th:      "th",
  vi:      "vi",
  id:      "id",
  ms:      "ms",
  fil:     "tl",
  fr:      "fr",
  es:      "es",
  de:      "de",
  it:      "it",
  pt:      "pt",
  ar:      "ar",
  nl:      "nl",
  pl:      "pl",
  ru:      "ru",
  tr:      "tr",
  sv:      "sv",
  da:      "da",
  fi:      "fi",
  no:      "no",
  he:      "iw",
  uk:      "uk",
  cs:      "cs",
  ro:      "ro",
  hu:      "hu",
  el:      "el",
};

export function getGoogleTranslateCode(langCode) {
  return GT_CODE_MAP[langCode] || langCode;
}

export function clearGoogleTranslateCookies() {
  const past    = "Thu, 01 Jan 1970 00:00:01 GMT";
  const domains = ["", window.location.hostname, `.${window.location.hostname}`];
  domains.forEach((domain) => {
    const d = domain ? `; domain=${domain}` : "";
    document.cookie = `googtrans=; path=/${d}; expires=${past}`;
  });
}

/** Small promise-based sleep. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait until the GT combo exists AND has at least 2 options (language list populated).
 * Retries every 200ms for up to 10 seconds.
 */
function waitForCombo() {
  return new Promise((resolve) => {
    const maxWait  = 10000;
    const interval = 200;
    let elapsed    = 0;

    const check = () => {
      const combo = document.querySelector(".goog-te-combo");
      // Combo must exist, have options loaded, and not be disabled
      if (combo && combo.options.length > 1 && !combo.disabled) {
        console.log("[GT] combo ready, options:", combo.options.length);
        resolve(combo);
        return;
      }
      elapsed += interval;
      if (elapsed >= maxWait) {
        console.warn("[GT] combo did not become ready within 10s");
        resolve(null);
        return;
      }
      setTimeout(check, interval);
    };

    // Brief initial delay so GT script has time to inject its DOM
    setTimeout(check, 300);
  });
}

/**
 * Fire a language change using the native HTMLSelectElement setter.
 * This bypasses React synthetic event wrappers and forces GT to see the real change.
 */
function fireCombo(combo, gtCode) {
  console.log("[GT] fireCombo — before:", combo.value, "→ setting:", gtCode);

  // Use native setter so event listeners inside GT's own code trigger correctly
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(combo, gtCode);
  } else {
    combo.value = gtCode;
  }

  // Dispatch multiple event types for maximum compatibility
  combo.dispatchEvent(new Event("change", { bubbles: true }));
  combo.dispatchEvent(new Event("input",  { bubbles: true }));

  // Also try the old-style HTMLEvent in case GT uses that internally
  try {
    const evt = document.createEvent("HTMLEvents");
    evt.initEvent("change", true, true);
    combo.dispatchEvent(evt);
  } catch (_) {}

  console.log("[GT] fireCombo — after:", combo.value);
}

/**
 * Apply a language with up to 3 retries.
 * Verifies the combo value actually changed before declaring success.
 * Falls back to cookie + one-time reload only if all retries fail.
 */
async function applyLanguageWithRetry(gtCode) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[GT] attempt ${attempt}/${MAX_RETRIES} for code: ${gtCode}`);

    const combo = await waitForCombo();

    if (!combo) {
      console.warn("[GT] no combo found on attempt", attempt);
      await sleep(400);
      continue;
    }

    fireCombo(combo, gtCode);

    // Wait for GT to process the change
    await sleep(500);

    // Verify the combo value reflects our change
    const freshCombo = document.querySelector(".goog-te-combo");
    if (freshCombo && freshCombo.value === gtCode) {
      console.log("[GT] translation applied successfully on attempt", attempt);
      return true;
    }

    console.warn("[GT] combo value did not stick on attempt", attempt, "got:", freshCombo?.value);
    await sleep(300);
  }

  // All retries failed — fallback to cookie + one-time reload
  console.warn("[GT] all retries failed, falling back to cookie reload");
  return false;
}

/**
 * Reset the page back to English.
 */
export async function resetGoogleTranslateToEnglish() {
  console.log("[GT] resetting to English");

  // Guard against reload loop
  if (sessionStorage.getItem(RELOAD_FLAG) === "1") {
    sessionStorage.removeItem(RELOAD_FLAG);
    clearGoogleTranslateCookies();
    return;
  }

  clearGoogleTranslateCookies();

  // Try widget first — no reload needed if it's responsive
  const combo = document.querySelector(".goog-te-combo");
  if (combo && combo.options.length > 1) {
    fireCombo(combo, "en");
    return;
  }

  // Widget not ready → reload once
  console.log("[GT] widget not ready for English reset, reloading");
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}

/**
 * Main entry point — apply a language.
 * Awaited by LanguageSwitcher so the UI can show a loading state.
 */
export async function applyGoogleTranslate(langCode) {
  console.log("[GT] applyGoogleTranslate called with:", langCode);

  if (langCode === "en") {
    await resetGoogleTranslateToEnglish();
    return;
  }

  const gtCode = getGoogleTranslateCode(langCode);
  console.log("[GT] mapped GT code:", gtCode);

  const success = await applyLanguageWithRetry(gtCode);

  if (!success) {
    // Cookie fallback — only reload once
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }
    console.log("[GT] using cookie + reload fallback for:", gtCode);
    document.cookie = `googtrans=/en/${gtCode}; path=/`;
    document.cookie = `googtrans=/en/${gtCode}; domain=.${window.location.hostname}; path=/`;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  }
}

/**
 * Called once on app mount (in i18n.jsx).
 * Re-applies the saved language after page load / navigation.
 *
 * IMPORTANT: The reload flag only prevents a second immediate reload.
 * It does NOT skip re-applying the saved language — we still translate after reload.
 */
export function initGoogleTranslateFromSavedLang() {
  // Consume the reload guard so we never loop, but still continue to apply language below
  const wasReloading = sessionStorage.getItem(RELOAD_FLAG) === "1";
  if (wasReloading) {
    sessionStorage.removeItem(RELOAD_FLAG);
    // Don't return — we still want to apply the saved language after the reload
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved || saved === "en") {
    clearGoogleTranslateCookies();
    return;
  }

  // Non-English: wait for combo then apply
  const gtCode = getGoogleTranslateCode(saved);
  console.log("[GT] init — re-applying saved language:", saved, "→", gtCode);

  waitForCombo().then((combo) => {
    if (combo) {
      fireCombo(combo, gtCode);
    } else {
      console.warn("[GT] init — combo not ready, skipping (will rely on cookie)");
    }
  });
}