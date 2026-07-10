import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const TERMS_VERSION = "v1";
const ACK_TEXT = "Your first AI flyer design is free. After that, each additional flyer change or new generation costs $1. By continuing, you acknowledge and agree to these charges.";
const CHECKBOX_LABEL = "I acknowledge and agree that each additional AI flyer change/generation after my first free flyer costs $1.";

export default function AIFlyerAcknowledgeModal({ eventId, onConfirmed, onCancel }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!checked) return;
    setSaving(true);
    await base44.functions.invoke("aiFlyerPayment", {
      action: "save_acknowledgement",
      eventId: eventId || "",
      acknowledgementText: ACK_TEXT,
      termsVersion: TERMS_VERSION,
    }).catch(() => {});
    toast.success("Your acknowledgement has been saved.");
    setSaving(false);
    onConfirmed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-6 space-y-5">

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-black text-lg">AI Flyer Pricing</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{ACK_TEXT}</p>
          </div>
        </div>

        {/* Checkbox acknowledgement */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                checked ? "bg-primary border-primary" : "border-border/70 bg-secondary group-hover:border-primary/50"
              }`}
              onClick={() => setChecked(v => !v)}
            >
              {checked && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-muted-foreground leading-relaxed" onClick={() => setChecked(v => !v)}>
            {CHECKBOX_LABEL}
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleContinue}
            disabled={!checked || saving}
            className="w-full h-11 font-display font-bold glow-lime"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Continue & Generate"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving} className="w-full">
            Cancel
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center font-mono leading-relaxed">
          Your acceptance is saved as a digital record. Each paid generation is added to a session cart and charged together in one payment.
        </p>
      </div>
    </div>
  );
}