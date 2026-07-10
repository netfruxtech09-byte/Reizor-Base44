import { useState, useEffect } from "react";
import { LogIn, UserPlus, X, Eye, EyeOff, ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import OnboardingModal from "./OnboardingModal";
import ArtistWelcomeModal from "@/components/artist/ArtistWelcomeModal";

/**
 * Global Auth Required Modal.
 * - "choose" mode: Sign In or Create Account buttons
 * - "signup" mode: inline email/password/name form using base44.auth.register()
 * Sign In always redirects to the hosted /login page (correct behavior).
 * Create Account uses the programmatic register API so signup form opens directly in-app.
 */
export default function AuthRequiredModal({ open, onClose, message }) {
  const [mode, setMode] = useState("choose"); // "choose" | "signup" | "verify" | "onboarding"
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend-code cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Reset verify state when the modal closes
  useEffect(() => {
    if (!open) {
      setOtp("");
      setVerifying(false);
      setResending(false);
      setResendCooldown(0);
    }
  }, [open]);

  if (!open) return null;

  // Check if user has pending checkout intent — if so, return to checkout page instead of event page
  const pendingCheckoutIntent = localStorage.getItem("pending_checkout_intent");
  const eventIdFromCheckout = window.location.pathname.includes("/events/") 
    ? window.location.pathname.split("/events/")[1].split("/")[0] 
    : null;
  const returnUrl = pendingCheckoutIntent && eventIdFromCheckout
    ? `/checkout/${eventIdFromCheckout}`
    : window.location.pathname + window.location.search;

  const handleClose = () => {
    setMode("choose");
    setForm({ full_name: "", email: "", password: "" });
    setShowPassword(false);
    setOtp("");
    setResendCooldown(0);
    onClose();
  };

  const handleSignIn = () => {
    base44.auth.redirectToLogin(returnUrl);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Please enter your name");
    if (!form.email.trim()) return toast.error("Please enter your email");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");

    setLoading(true);
    try {
      await base44.auth.register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
      });
      // Account created but email is unverified — move to the in-app
      // verification code screen instead of attempting (and failing) login.
      setOtp("");
      setResendCooldown(30);
      setMode("verify");
      toast.success("Verification code sent to your email.");
    } catch (err) {
      toast.error(err?.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the OTP the user entered, then log them in.
  const handleVerify = async (e) => {
    e?.preventDefault();
    const code = otp.trim();
    if (!/^\d{4,8}$/.test(code)) return toast.error("Enter the 6-digit code from your email");
    setVerifying(true);
    try {
      await base44.auth.verifyOtp({ email: form.email.trim(), otpCode: code });
      const { access_token } = await base44.auth.loginViaEmailPassword(
        form.email.trim(),
        form.password
      );
      if (access_token) localStorage.setItem("base44_access_token", access_token);
      toast.success("Email verified! Welcome to Reizor.");
      setMode("onboarding");
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("expire") || msg.includes("invalid") || msg.includes("code")) {
        toast.error("That code is invalid or expired. Tap resend to get a new one.");
      } else {
        toast.error(err?.message || "Verification failed. Please try again.");
      }
      setOtp("");
    } finally {
      setVerifying(false);
    }
  };

  // Resend the verification code (rate-limited by the platform + a 30s UI cooldown).
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await base44.auth.resendOtp(form.email.trim());
      setResendCooldown(30);
      toast.success("A new verification code has been sent.");
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already") && msg.includes("verif")) {
        toast.success("This email is already verified — try logging in.");
      } else if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
        toast.error("Too many attempts. Please wait a moment before resending.");
      } else {
        toast.error(err?.message || "Could not resend the code. Try again.");
      }
    } finally {
      setResending(false);
    }
  };

  // Back to the signup form to change the email (keeps name/password).
  const handleChangeEmail = () => {
    setOtp("");
    setResendCooldown(0);
    setMode("signup");
  };

  // Show artist welcome modal if the user had artist intent
  if (mode === "onboarding" && localStorage.getItem("artist_signup_intent") === "true") {
    return (
      <ArtistWelcomeModal
        open={true}
        userName={form.full_name}
        onContinue={() => {
          localStorage.removeItem("artist_signup_intent");
          window.location.href = "/artist/signup";
        }}
        onClose={() => {
          localStorage.removeItem("artist_signup_intent");
          window.location.href = returnUrl;
        }}
      />
    );
  }

  // Show generic onboarding modal after signup (replaces the auth modal)
  if (mode === "onboarding") {
    return (
      <OnboardingModal
        open={true}
        userName={form.full_name}
        onComplete={() => {
          window.location.href = returnUrl;
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-sm mx-4 mb-0 sm:mb-0 rounded-t-2xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-80" />

        <div className="p-6 space-y-5">
          {/* ── Choose mode ─────────────────────────────────────── */}
          {mode === "choose" && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display font-black text-xl tracking-tight">Sign in required</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {message || "Please sign in or create an account to continue."}
                  </p>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <Button onClick={handleSignIn} className="w-full h-12 glow-lime font-display font-bold text-base gap-2">
                  <LogIn className="w-4 h-4" /> Sign In
                </Button>
                <Button
                  onClick={() => setMode("signup")}
                  variant="outline"
                  className="w-full h-12 font-display font-bold text-base gap-2 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <UserPlus className="w-4 h-4" /> Create Account
                </Button>
                <button onClick={handleClose} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ── Signup form mode ────────────────────────────────── */}
          {mode === "signup" && (
            <>
              <div className="flex items-center justify-between">
                <button onClick={() => setMode("choose")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h2 className="font-display font-black text-xl tracking-tight">Create Account</h2>
                <p className="text-sm text-muted-foreground mt-1">Join to continue</p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Full Name</Label>
                  <Input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Your name"
                    className="mt-1 bg-secondary border-border/50"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="mt-1 bg-secondary border-border/50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="bg-secondary border-border/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 glow-lime font-display font-bold text-base mt-1">
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button onClick={handleSignIn} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ── Verify mode ─────────────────────────────────────── */}
          {mode === "verify" && (
            <>
              <div className="flex items-center justify-between">
                <button onClick={handleChangeEmail} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-display font-black text-xl tracking-tight">Enter Verification Code</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a 6-digit code to<br />
                  <span className="text-foreground font-medium font-mono">{form.email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter code"
                  className="text-center text-2xl tracking-[0.5em] font-bold bg-secondary border-border/50"
                  autoFocus
                />
                <Button type="submit" disabled={verifying} className="w-full h-12 glow-lime font-display font-bold text-base">
                  {verifying ? "Verifying..." : "Verify"}
                </Button>
              </form>

              <div className="flex items-center justify-between text-sm">
                <button onClick={handleChangeEmail} className="text-muted-foreground hover:text-foreground transition-colors">
                  Change email
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="flex items-center gap-1.5 text-primary hover:underline disabled:opacity-50 disabled:no-underline transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Didn't get it? Check your spam folder, or tap resend.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}