import { useState, useEffect, useRef } from "react";
import { Globe, Loader2 } from "lucide-react";
import { useTranslation, LANGUAGES } from "@/lib/i18n";
import { applyGoogleTranslate } from "@/lib/googleTranslate";

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = async (code) => {
    if (translating) return; // prevent rapid double-clicks during translation
    setOpen(false);
    setLang(code);
    setTranslating(true);
    await applyGoogleTranslate(code);
    setTranslating(false);
  };

  // Always read label from the JS constant — GT must never touch this value
  const currentLabel = LANGUAGES.find(l => l.code === lang)?.label ?? "English";

  return (
    // notranslate + translate="no" prevent Google Translate from touching this whole subtree
    <div ref={ref} className="relative notranslate" translate="no">
      <button
        onClick={() => !translating && setOpen(v => !v)}
        disabled={translating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card/60 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground text-xs font-mono font-bold notranslate disabled:opacity-60 disabled:cursor-wait"
        translate="no"
      >
        {translating
          ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          : <Globe className="w-3.5 h-3.5 shrink-0" />
        }
        <span className="hidden sm:inline max-w-[80px] truncate notranslate" translate="no">
          {currentLabel}
        </span>
      </button>

      {open && !translating && (
        <div
          className="absolute right-0 top-full mt-2 w-56 max-h-80 overflow-y-auto rounded-xl border border-border/50 bg-card shadow-xl z-50 notranslate"
          translate="no"
        >
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              translate="no"
              className={`w-full text-left px-4 py-2.5 text-sm font-mono font-bold transition-colors hover:bg-muted notranslate ${
                lang === l.code ? "text-primary bg-primary/10" : "text-foreground"
              }`}
            >
              <span className="notranslate" translate="no">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}