import { useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const OTP_EXPIRY_SECS = 300;

/**
 * TwoFactorSettings — shown on the Profile page.
 * Allows users to enable or disable 2FA on their account.
 *
 * Props:
 *   user         — current user object
 *   onUpdate(u)  — called with the updated user after toggling 2FA
 */
export default function TwoFactorSettings({ user, onUpdate }) {
  const isEnabled = !!user?.two_factor_enabled;

  // --- Enable flow state ---
  const [enableStep, setEnableStep] = useState("idle"); // idle | sending | sent | verifying | done
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- Disable flow state ---
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const startCountdown = (secs) => {
    setCountdown(secs);
    setOtpExpired(false);
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); setOtpExpired(true); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const sendOtp = async () => {
    setEnableStep("sending");
    setErrorMsg("");
    setOtp("");
    setOtpExpired(false);

    try {
      const res = await base44.functions.invoke("twoFactorAuth", { action: "send" });
      if (res.data?.success) {
        setEnableStep("sent");
        startCountdown(OTP_EXPIRY_SECS);
      } else {
        setEnableStep("idle");
        setErrorMsg(res.data?.error || "Failed to send code.");
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.error === "too_soon") {
        setEnableStep("sent");
        startCountdown(data.wait_seconds || OTP_EXPIRY_SECS);
        setErrorMsg(data.message);
      } else {
        setEnableStep("idle");
        setErrorMsg("Failed to send verification code. Please try again.");
      }
    }
  };

  const verifyAndEnable = async () => {
    if (!otp.trim() || otp.length !== 6) { setErrorMsg("Please enter the 6-digit code."); return; }
    setEnableStep("verifying");
    setErrorMsg("");

    try {
      const res = await base44.functions.invoke("twoFactorAuth", { action: "verify", otp: otp.trim() });
      if (res.data?.success) {
        await base44.auth.updateMe({ two_factor_enabled: true });
        setEnableStep("done");
        onUpdate({ ...user, two_factor_enabled: true });
        toast.success("Two-Factor Authentication has been enabled for your account.");
      } else {
        setEnableStep("sent");
        setErrorMsg(res.data?.message || "Verification failed.");
      }
    } catch (err) {
      const data = err?.response?.data;
      const errType = data?.error;
      if (errType === "expired") { setOtpExpired(true); setCountdown(0); setEnableStep("sent"); setErrorMsg("Code expired. Request a new one."); }
      else if (errType === "too_many_attempts") { setOtpExpired(true); setCountdown(0); setEnableStep("sent"); setErrorMsg("Too many failed attempts. Request a new code."); }
      else { setEnableStep("sent"); setErrorMsg(data?.message || "Verification failed. Try again."); }
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    await base44.auth.updateMe({ two_factor_enabled: false });
    // Clear any active session 2FA flags so the gate doesn't re-fire
    sessionStorage.setItem("2fa_verified", "1");
    sessionStorage.setItem("2fa_email", user.email);
    onUpdate({ ...user, two_factor_enabled: false });
    setDisableConfirm(false);
    setDisabling(false);
    // Reset enable flow so the Enable button is immediately visible again
    setEnableStep("idle");
    setOtp("");
    setErrorMsg("");
    setOtpExpired(false);
    setCountdown(0);
    toast.success("Two-Factor Authentication has been disabled. You can enable it again anytime from your profile settings.");
  };

  const resetEnableFlow = () => {
    setEnableStep("idle");
    setOtp("");
    setErrorMsg("");
    setOtpExpired(false);
    setCountdown(0);
  };

  return (
    <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isEnabled ? "bg-green-400/15" : "bg-muted"}`}>
          {isEnabled
            ? <ShieldCheck className="w-5 h-5 text-green-400" />
            : <ShieldOff className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div>
          <p className="font-display font-bold text-sm">Two-Factor Authentication</p>
          <p className={`text-xs font-mono font-bold ${isEnabled ? "text-green-400" : "text-muted-foreground"}`}>
            {isEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Add an extra layer of security to your account. When enabled, you'll be asked for a verification code sent to your email each time you log in.
      </p>

      {/* ── ENABLED STATE ── */}
      {isEnabled && (
        <>
          {!disableConfirm ? (
            <button
              onClick={() => setDisableConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" /> Disable 2FA
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
              <p className="text-sm font-bold text-destructive">Disable Two-Factor Authentication?</p>
              <p className="text-xs text-muted-foreground">Your account will be less secure. You can re-enable 2FA at any time.</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDisable}
                  disabled={disabling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-display font-bold"
                >
                  {disabling ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Disabling…</> : "Yes, Disable"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDisableConfirm(false)} disabled={disabling}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── DISABLED STATE ── */}
      {!isEnabled && (
        <>
          {enableStep === "idle" && (
            <Button
              size="sm"
              onClick={sendOtp}
              className="gap-2 font-display font-bold glow-lime"
            >
              <ShieldCheck className="w-4 h-4" /> Enable
            </Button>
          )}

          {enableStep === "sending" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="w-4 h-4 animate-spin" /> Sending verification code…
            </div>
          )}

          {(enableStep === "sent" || enableStep === "verifying") && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-mono">
                We sent a 6-digit code to <span className="font-bold text-foreground">{user.email}</span>. Enter it below to activate 2FA.
              </p>

              <Input
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setErrorMsg(""); }}
                onKeyDown={e => e.key === "Enter" && verifyAndEnable()}
                placeholder="000000"
                maxLength={6}
                className="text-center text-xl font-mono tracking-[0.5em] bg-secondary border-border/50 h-12 max-w-[200px]"
                disabled={enableStep === "verifying" || otpExpired}
                autoFocus
              />

              {errorMsg && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{errorMsg}</p>
                </div>
              )}

              {countdown > 0 && !otpExpired && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  Code expires in <span className={`font-bold ${countdown <= 60 ? "text-destructive" : "text-foreground"}`}>{formatCountdown(countdown)}</span>
                </p>
              )}

              {otpExpired && (
                <p className="text-xs text-yellow-400 font-mono">Code expired. Please request a new one.</p>
              )}

              <div className="flex gap-2 items-center flex-wrap">
                <Button
                  size="sm"
                  onClick={verifyAndEnable}
                  disabled={enableStep === "verifying" || otpExpired || otp.length !== 6}
                  className="gap-1.5 font-display font-bold glow-lime"
                >
                  {enableStep === "verifying"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</>
                    : <><ShieldCheck className="w-3.5 h-3.5" /> Verify & Enable</>}
                </Button>

                <button
                  onClick={sendOtp}
                  disabled={countdown > 0 && !otpExpired}
                  className={`flex items-center gap-1 text-xs font-mono transition-colors ${countdown > 0 && !otpExpired ? "text-muted-foreground/40 cursor-not-allowed" : "text-accent hover:text-accent/80 cursor-pointer"}`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {countdown > 0 && !otpExpired ? `Resend in ${formatCountdown(countdown)}` : "Resend code"}
                </button>

                <button onClick={resetEnableFlow} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {enableStep === "done" && (
            <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
              <CheckCircle2 className="w-5 h-5" />
              2FA is now active. Disable it below if needed.
            </div>
          )}
        </>
      )}
    </div>
  );
}