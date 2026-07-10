import { useState } from "react";
import { MapPin, Music2, Bell, ChevronRight, Check, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const GENRES = [
  { key: "techno", label: "Techno" },
  { key: "house", label: "House" },
  { key: "drum_and_bass", label: "D&B" },
  { key: "trance", label: "Trance" },
  { key: "hip_hop", label: "Hip-Hop" },
  { key: "rnb", label: "R&B" },
  { key: "pop", label: "Pop" },
  { key: "rock", label: "Rock" },
  { key: "electronic", label: "Electronic" },
  { key: "latin", label: "Latin" },
  { key: "reggaeton", label: "Reggaeton" },
  { key: "afrobeats", label: "Afrobeats" },
  { key: "jazz", label: "Jazz" },
];

const STEPS = [
  { id: "personal", label: "Personal Info", icon: MapPin },
  { id: "genres", label: "Music Taste", icon: Music2 },
];

/**
 * Post-signup onboarding modal.
 * Shown immediately after account creation.
 * Saves data via base44.auth.updateMe() — same fields as Profile page.
 * User can skip; data remains editable from Profile anytime.
 */
export default function OnboardingModal({ open, onComplete, userName }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [form, setForm] = useState({
    city: "",
    state: "",
    phone: "",
    bio: "",
    date_of_birth: "",
    gender: "",
    preferred_genres: [],
  });

  if (!open) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const toggleGenre = (key) => {
    setForm((f) => ({
      ...f,
      preferred_genres: f.preferred_genres.includes(key)
        ? f.preferred_genres.filter((g) => g !== key)
        : [...f.preferred_genres, key],
    }));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          "";
        if (city) setForm((f) => ({ ...f, city }));
        setDetectingLocation(false);
      },
      () => setDetectingLocation(false)
    );
  };

  const handleNext = async () => {
    if (isLast) {
      await handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      toast.success("Profile set up! Welcome 🎉");
    } catch {
      // Non-blocking — preferences saved on best effort
    }
    setSaving(false);
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="font-display font-black text-xl tracking-tight mt-0.5">
                {step === 0
                  ? `Welcome${userName ? `, ${userName.split(" ")[0]}` : ""}! 👋`
                  : "Your Music Taste 🎵"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {step === 0
                  ? "Tell us a bit about yourself so we can personalize your experience."
                  : "Pick your favorite genres to get alerts for matching events."}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Skip for now"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step: Personal Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">City</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="New York"
                      className="pl-9 bg-secondary border-border/50"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="border-border/50 text-muted-foreground hover:text-primary shrink-0"
                    title="Detect my location"
                  >
                    <Navigation
                      className={`w-4 h-4 ${detectingLocation ? "animate-pulse text-primary" : ""}`}
                    />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">State / Province (optional)</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="e.g. New York"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Date of Birth (optional)</Label>
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    className="mt-1 bg-secondary border-border/50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Gender (optional)</Label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Phone (optional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Bio (optional)</Label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={2}
                  placeholder="Tell us about yourself..."
                  className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Step: Music Genres */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-muted-foreground font-mono">
                  We'll send you alerts for new events matching your taste
                  {form.city ? ` in ${form.city}` : ""}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const active = form.preferred_genres.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => toggleGenre(g.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition-all ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 inline mr-1" />}
                      {g.label}
                    </button>
                  );
                })}
              </div>
              {form.preferred_genres.length > 0 && (
                <p className="text-xs text-primary font-mono font-bold">
                  ✓ {form.preferred_genres.length} genre{form.preferred_genres.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 h-11 glow-lime font-display font-bold gap-2"
            >
              {saving ? (
                "Saving..."
              ) : isLast ? (
                <>
                  <Check className="w-4 h-4" /> Finish Setup
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              Skip
            </button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground font-mono">
            You can always update these from your Profile settings
          </p>
        </div>
      </div>
    </div>
  );
}