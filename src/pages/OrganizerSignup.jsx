import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, CheckCircle2, ArrowLeft, Phone, Globe, User } from "lucide-react";
import LocationSelector from "@/components/shared/LocationSelector";

export default function OrganizerSignup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    website: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    localStorage.removeItem("organizer_signup_intent");
    base44.auth.me().then(async (u) => {
      if (!u) {
        base44.auth.redirectToLogin("/organizer/signup");
        return;
      }
      setUser(u);
      // Already an organizer — go straight to dashboard
      if (u.role === "organizer" || u.role === "manager" || u.role === "admin") {
        navigate("/organizer", { replace: true });
        return;
      }
      // Do not pre-fill business name — user should enter their own organization name.
      // Contact name may be pre-filled from the account since it's for internal use only.
      setForm(f => ({ ...f, contact_name: u.full_name || "" }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      setErrors({ business_name: "Please enter the public Organizer, business, venue, or brand name." });
      toast.error("Public Organizer / Business / Brand name is required");
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Upgrade role to organizer + create OrganizerProfile with the correct public vs. contact fields
    await base44.functions.invoke("becomeOrganizer", {
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim(),
      phone: form.phone,
      city: form.city,
      state: form.state,
      country: form.country,
      website: form.website,
    });

    // Set account mode to host
    localStorage.setItem("active_account_mode", "host");

    setDone(true);
    setSubmitting(false);

    // Refresh user and redirect to organizer dashboard
    setTimeout(() => navigate("/organizer", { replace: true }), 1800);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">Welcome aboard! 🎉</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your organizer account is ready. Redirecting to your dashboard…
            </p>
          </div>
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12 px-4 safe-top-header">
      <div className="max-w-lg mx-auto space-y-6 sm:space-y-8">

        <button
          onClick={() => navigate("/", { replace: true })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-accent" />
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight">
            Sign Up as Organizer
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Create your organizer account to host events, manage tickets, and grow your audience. No event required right now.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4 p-5 rounded-2xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">Organization Details</h3>

            <div>
              <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Organizer Name *
              </Label>
              <Input
                value={form.business_name}
                onChange={e => { update("business_name", e.target.value); if (errors.business_name) setErrors({}); }}
                placeholder="e.g. Halfmoon Festival"
                className={`mt-1.5 bg-secondary ${errors.business_name ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`}
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1 font-mono leading-relaxed">
                Enter the public name Fans will see on your Organizer page. This can be your venue, event brand, festival, promotion company, or business name — not your personal name unless that is your public organizer brand. e.g. Tomorrowland, Marquee Skydeck, Halfmoon Festival, Reizor Events NYC
              </p>
              {errors.business_name && <p className="text-xs text-destructive mt-1">{errors.business_name}</p>}
              {form.business_name.trim() && (
                <p className="text-xs text-primary mt-2 font-mono">Your public Organizer page will appear as: <strong>{form.business_name.trim()}</strong></p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Personal Name
              </Label>
              <Input
                value={form.contact_name}
                onChange={e => update("contact_name", e.target.value)}
                placeholder="e.g. John Smith"
                className="mt-1.5 bg-secondary border-border/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">For internal account communication only. This is not shown as your Organizer page name.</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </Label>
              <Input
                value={form.phone}
                onChange={e => update("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="mt-1.5 bg-secondary border-border/50"
                type="tel"
              />
            </div>

            <div className="space-y-3">
               <LocationSelector
                 value={{ country: form.country, state: form.state, city: form.city }}
                 onChange={({ country, state, city }) => setForm(f => ({ ...f, country, state, city }))}
                 required={false}
               />
               <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                 <p className="text-xs text-white font-mono leading-relaxed">
                   💡 <strong>Add your city and state</strong> so fans can be notified about your events, raffles, polls, bookings, and activity based on location.
                 </p>
               </div>
             </div>

            <div>
              <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Website (optional)
              </Label>
              <Input
                value={form.website}
                onChange={e => update("website", e.target.value)}
                placeholder="https://yoursite.com"
                className="mt-1.5 bg-secondary border-border/50"
                type="url"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 glow-lime font-display font-bold text-base"
          >
            {submitting ? "Setting up your account…" : "Create Organizer Account →"}
          </Button>

          <p className="text-center text-xs text-muted-foreground font-mono">
            Already have an organizer account?{" "}
            <button type="button" onClick={() => navigate("/organizer")} className="text-accent hover:underline">
              Go to Dashboard
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}