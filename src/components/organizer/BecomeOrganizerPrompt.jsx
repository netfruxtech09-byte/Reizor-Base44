import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BecomeOrganizerPrompt({ user, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState("info"); // "info" | "form" | "converting"
  const [form, setForm] = useState({
    display_name: user?.full_name || "",
    city: "",
    genre: "",
  });
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    try {
      await base44.functions.invoke("becomeOrganizer", {});
      // Update profile with collected details
      if (form.display_name && form.display_name !== user.full_name) {
        await base44.auth.updateMe({ full_name: form.display_name }).catch(() => {});
      }
      // Create or update OrganizerProfile
      const profiles = await base44.entities.OrganizerProfile.filter(
        { organizer_id: user.id }, null, 1
      ).catch(() => []);
      if (profiles[0]) {
        await base44.entities.OrganizerProfile.update(profiles[0].id, {
          city: form.city,
          genre: form.genre,
          full_name: form.display_name || user.full_name,
          business_name: form.display_name || user.full_name,
        }).catch(() => {});
      }
      toast.success("You're now an Organizer! Redirecting to create your first event...");
      setTimeout(() => {
        navigate("/organizer/create", { replace: true });
      }, 800);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card border border-primary/30 shadow-2xl p-6 space-y-5">
        {step === "info" && (
          <>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-black text-xl">Become an Organizer</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  To create events, sell tickets, and manage your own shows, you need to upgrade to an Organizer account. It's free and instant.
                </p>
              </div>
            </div>
            <div className="space-y-2 p-4 rounded-xl bg-secondary/60 border border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary text-lg">🎟️</span>
                <span className="font-medium">Create & sell tickets to your events</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary text-lg">📊</span>
                <span className="font-medium">Track analytics, payouts & performance</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary text-lg">🎨</span>
                <span className="font-medium">Generate AI flyers & manage media</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Not Now
              </Button>
              <Button onClick={() => setStep("form")} className="flex-1 glow-lime font-bold gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <div className="text-center space-y-2">
              <h2 className="font-display font-black text-xl">Tell us about yourself</h2>
              <p className="text-sm text-muted-foreground">Quick info to set up your organizer profile.</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Display Name</Label>
                <Input
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Your name or brand"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">City</Label>
                <Input
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Miami"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Main Music Genre</Label>
                <Input
                  value={form.genre}
                  onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  placeholder="e.g. techno, house, hip-hop"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("info")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleConvert} disabled={converting} className="flex-1 glow-lime font-bold gap-2">
                {converting ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</> : "Become Organizer"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}