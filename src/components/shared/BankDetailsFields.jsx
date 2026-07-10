import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

const COUNTRIES = [
  { value: "USA", flag: "🇺🇸", label: "United States (USA)" },
  { value: "UK", flag: "🇬🇧", label: "United Kingdom (UK)" },
  { value: "India", flag: "🇮🇳", label: "India" },
  { value: "Canada", flag: "🇨🇦", label: "Canada" },
  { value: "Australia", flag: "🇦🇺", label: "Australia" },
  { value: "Germany", flag: "🇩🇪", label: "Germany" },
  { value: "France", flag: "🇫🇷", label: "France" },
  { value: "Spain", flag: "🇪🇸", label: "Spain" },
  { value: "Italy", flag: "🇮🇹", label: "Italy" },
  { value: "Netherlands", flag: "🇳🇱", label: "Netherlands" },
  { value: "Brazil", flag: "🇧🇷", label: "Brazil" },
  { value: "Mexico", flag: "🇲🇽", label: "Mexico" },
  { value: "UAE", flag: "🇦🇪", label: "UAE" },
  { value: "Singapore", flag: "🇸🇬", label: "Singapore" },
  { value: "Other", flag: "🌍", label: "Other" },
];

/**
 * Reusable bank details form fields.
 *
 * Props:
 *  form         - current form state object
 *  onChange(key, value) - called on field change
 *  errors       - fieldErrors object
 *  bgClass      - optional Tailwind bg class for inputs (default "bg-secondary")
 *  showPassword - whether account number is type="password" (default false)
 */
export default function BankDetailsFields({ form, onChange, errors = {}, bgClass = "bg-secondary", showPassword = false }) {
  const isNonUSA = form.country && form.country.trim().toUpperCase() !== "USA";
  const fe = errors;

  return (
    <div className="space-y-3">
      {/* Account Holder + Bank Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Account Holder Name *</Label>
          <Input
            value={form.account_holder_name || ""}
            onChange={e => onChange("account_holder_name", e.target.value)}
            placeholder="Full legal name"
            className={`mt-1 ${bgClass} border-border/50 ${fe.account_holder_name ? "border-destructive" : ""}`}
          />
          <FieldError msg={fe.account_holder_name} />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Bank Name *</Label>
          <Input
            value={form.bank_name || ""}
            onChange={e => onChange("bank_name", e.target.value)}
            placeholder="e.g. Chase, HDFC, Barclays"
            className={`mt-1 ${bgClass} border-border/50 ${fe.bank_name ? "border-destructive" : ""}`}
          />
          <FieldError msg={fe.bank_name} />
        </div>
      </div>

      {/* Country */}
      <div>
        <Label className="text-xs font-mono text-muted-foreground">Country *</Label>
        <Select value={form.country || "USA"} onValueChange={v => onChange("country", v)}>
          <SelectTrigger className={`mt-1 ${bgClass} border-border/50 ${fe.country ? "border-destructive" : ""}`}>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.flag} {c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError msg={fe.country} />
      </div>

      {/* Bank Address — only for non-USA */}
      {isNonUSA && (
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Bank Address *</Label>
          <Input
            value={form.bank_address || ""}
            onChange={e => onChange("bank_address", e.target.value)}
            placeholder="Full bank branch address"
            className={`mt-1 ${bgClass} border-border/50 ${fe.bank_address ? "border-destructive" : ""}`}
          />
          <FieldError msg={fe.bank_address} />
        </div>
      )}

      {/* Account Number + Routing Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Account Number *</Label>
          <Input
            type={showPassword ? "password" : "text"}
            value={form.account_number || ""}
            onChange={e => onChange("account_number", e.target.value)}
            placeholder="••••••••"
            className={`mt-1 ${bgClass} border-border/50 ${fe.account_number ? "border-destructive" : ""}`}
          />
          <FieldError msg={fe.account_number} />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">
            {isNonUSA ? "Routing / Sort Code *" : "Routing Number *"}
          </Label>
          <Input
            value={form.routing_number || ""}
            onChange={e => onChange("routing_number", e.target.value)}
            placeholder={isNonUSA ? "Sort / routing code" : "9-digit routing number"}
            className={`mt-1 ${bgClass} border-border/50 ${fe.routing_number ? "border-destructive" : ""}`}
          />
          <FieldError msg={fe.routing_number} />
        </div>
      </div>

      {/* Account Type */}
      <div>
        <Label className="text-xs font-mono text-muted-foreground">Account Type *</Label>
        <Select value={form.account_type || "checking"} onValueChange={v => onChange("account_type", v)}>
          <SelectTrigger className={`mt-1 ${bgClass} border-border/50`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SWIFT + IBAN — only for non-USA */}
      {isNonUSA && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">SWIFT / BIC Code *</Label>
              <Input
                value={form.swift_code || ""}
                onChange={e => onChange("swift_code", e.target.value.toUpperCase())}
                placeholder="e.g. CHASUS33"
                className={`mt-1 ${bgClass} border-border/50 ${fe.swift_code ? "border-destructive" : ""}`}
              />
              <FieldError msg={fe.swift_code} />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">IBAN *</Label>
              <Input
                value={form.iban || ""}
                onChange={e => onChange("iban", e.target.value.toUpperCase())}
                placeholder="e.g. GB29 NWBK..."
                className={`mt-1 ${bgClass} border-border/50 ${fe.iban ? "border-destructive" : ""}`}
              />
              <FieldError msg={fe.iban} />
            </div>
          </div>
          <p className="text-xs text-yellow-400 font-mono bg-yellow-400/10 px-3 py-2 rounded">
            ⚠ SWIFT/BIC Code, IBAN, and Bank Address are required for accounts outside the USA.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Shared validation logic for bank details forms.
 * Returns an errors object; empty object means valid.
 */
export function validateBankDetails(form) {
  const isNonUSA = form.country && form.country.trim().toUpperCase() !== "USA";
  const errs = {};

  if (!form.account_holder_name?.trim()) errs.account_holder_name = "Account Holder Name is required";
  if (!form.bank_name?.trim()) errs.bank_name = "Bank Name is required";
  if (!form.country?.trim()) errs.country = "Country is required";

  if (!form.account_number?.trim()) {
    errs.account_number = "Account Number is required";
  } else if (!/^\d{5,20}$/.test(form.account_number.trim())) {
    errs.account_number = "Account Number must be 5–20 digits";
  }

  if (!form.routing_number?.trim()) {
    errs.routing_number = isNonUSA ? "Routing / Sort Code is required" : "Routing Number is required";
  } else if (!isNonUSA && !/^\d{9}$/.test(form.routing_number.trim())) {
    errs.routing_number = "US Routing Number must be exactly 9 digits";
  }

  if (isNonUSA) {
    if (!form.bank_address?.trim()) errs.bank_address = "Bank Address is required for non-USA accounts";

    if (!form.swift_code?.trim()) {
      errs.swift_code = "SWIFT/BIC Code is required for non-USA accounts";
    } else if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(form.swift_code.trim().toUpperCase())) {
      errs.swift_code = "Invalid SWIFT/BIC Code (e.g. CHASUS33)";
    }

    if (!form.iban?.trim()) {
      errs.iban = "IBAN is required for non-USA accounts";
    } else if (form.iban.trim().length < 15 || form.iban.trim().length > 34) {
      errs.iban = "IBAN must be 15–34 characters";
    }
  }

  return errs;
}