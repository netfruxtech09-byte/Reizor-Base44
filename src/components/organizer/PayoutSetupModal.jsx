import { useState } from "react";
import { Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import BankDetailsFields, { validateBankDetails } from "@/components/shared/BankDetailsFields";

export default function PayoutSetupModal({ user, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    account_holder_name: user?.full_name || "",
    bank_name: "",
    account_number: "",
    routing_number: "",
    account_type: "checking",
    country: "USA",
    swift_code: "",
    iban: "",
    bank_address: "",
    notes: "",
  });

  const update = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors(e => ({ ...e, [field]: null }));
  };

  const handleSave = async () => {
    const errs = validateBankDetails(form);
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setSaving(true);
    await base44.entities.OrganizerBankInfo.create({
      ...form,
      organizer_id: user.id,
      organizer_email: user.email,
    });
    toast.success("Payout bank info saved!");
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header — fixed */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg">Payout Setup</h2>
              <p className="text-xs text-muted-foreground">Add your bank info to receive payouts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          <BankDetailsFields form={form} onChange={update} errors={fieldErrors} bgClass="bg-secondary" />
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Notes</Label>
            <Input value={form.notes} onChange={e => update("notes", e.target.value)}
              placeholder="Any additional info" className="mt-1 bg-secondary border-border/50" />
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="flex gap-3 px-5 py-4 border-t border-border/30 shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 glow-lime font-display font-bold">
            {saving ? "Saving..." : "Save Bank Info"}
          </Button>
        </div>
      </div>
    </div>
  );
}