import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Mail, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

const OTP_EXPIRY_SECS = 300; // 5 minutes

export default function TwoFactorModal({ user, onVerified }) {
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | verifying | error | success
  const [errorMsg, setErrorMsg] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [countdown, setCountdown] = useState(0); // seconds until resend allowed
  const [otpExpired, setOtpExpired] = useState(false);
  const intervalRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-send OTP on mount
  useEffect(() => {
    sendOtp(true);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(intervalRef.current);
          setOtpExpired(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [countdown]);

  const sendOtp = async (isInitial = false) => {
    if (!isInitial && countdown > 0) {
      const mins = Math.ceil(countdown / 60);
      setErrorMsg(`Please wait ${mins} minute(s) before requesting a new OTP.`);
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    setOtpExpired(false);
    setOtp("");

    let res;
    try {
      res = await base44.functions.invoke("twoFactorAuth", { action: "send" });
    } catch (err) {
      const data = err?.response?.data;
      if (data?.error === "too_soon") {
        setStatus("sent");
        const wait = data.wait_seconds || OTP_EXPIRY_SECS;
        setCountdown(wait);
        setErrorMsg(data.message);
        return;
      }
      setStatus("error");
      setErrorMsg("Failed to send OTP. Please try again.");
      return;
    }

    if (res.data?.success) {
      setStatus("sent");
      setExpiresAt(res.data.expires_at);
      setCountdown(OTP_EXPIRY_SECS);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setStatus("error");
      setErrorMsg(res.data?.error || "Failed to send OTP. Please try again.");
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setErrorMsg("Please enter the 6-digit code.");
      return;
    }
    setStatus("verifying");
    setErrorMsg("");

    let res;
    try {
      res = await base44.functions.invoke("twoFactorAuth", { action: "verify", otp: otp.trim() });
    } catch (err) {
      const data = err?.response?.data;
      const errType = data?.error;
      if (errType === "expired") {
        setOtpExpired(true);
        setCountdown(0);
        setStatus("sent");
        setErrorMsg("OTP has expired. Please request a new one.");
      } else if (errType === "too_many_attempts") {
        setOtpExpired(true);
        setCountdown(0);
        setStatus("sent");
        setErrorMsg("Too many failed attempts. Please request a new OTP.");
      } else {
        setStatus("sent");
        setErrorMsg(data?.message || "Verification failed. Please try again.");
      }
      return;
    }

    if (res.data?.success) {
      setStatus("success");
      sessionStorage.setItem("2fa_verified", "1");
      sessionStorage.setItem("2fa_email", user.email);
      setTimeout(() => onVerified(), 800);
    } else {
      setStatus("sent");
      setErrorMsg(res.data?.message || "Verification failed. Please try again.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") verifyOtp();
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/30 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-black text-xl tracking-tight">Two-Factor Verification</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to{" "}
              <span className="font-bold text-foreground">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="font-bold text-green-400">Verified! Redirecting…</p>
            </div>
          ) : (
            <>
              {/* OTP Input */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Enter verification code
                </label>
                <Input
                  ref={inputRef}
                  value={otp}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(val);
                    setErrorMsg("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-[0.5em] bg-secondary border-border/50 h-14"
                  disabled={status === "sending" || status === "verifying" || otpExpired}
                />
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{errorMsg}</p>
                </div>
              )}

              {/* Expired notice */}
              {otpExpired && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">Your OTP has expired. Please request a new one.</p>
                </div>
              )}

              {/* Timer */}
              {countdown > 0 && !otpExpired && (
                <p className="text-xs text-center font-mono text-muted-foreground">
                  Code expires in{" "}
                  <span className={`font-bold ${countdown <= 60 ? "text-destructive" : "text-foreground"}`}>
                    {formatCountdown(countdown)}
                  </span>
                </p>
              )}

              {/* Verify button */}
              <Button
                onClick={verifyOtp}
                disabled={status === "verifying" || status === "sending" || otpExpired || otp.length !== 6}
                className="w-full glow-lime font-display font-bold gap-2 h-11"
              >
                {status === "verifying" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Verify & Continue</>
                )}
              </Button>

              {/* Resend */}
              <div className="text-center">
                {status === "sending" ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending code…
                  </div>
                ) : (
                  <button
                    onClick={() => sendOtp(false)}
                    disabled={countdown > 0 && !otpExpired}
                    className={`flex items-center gap-1.5 mx-auto text-xs font-mono transition-colors ${
                      countdown > 0 && !otpExpired
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-accent hover:text-accent/80 cursor-pointer"
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {countdown > 0 && !otpExpired
                      ? `Resend available in ${formatCountdown(countdown)}`
                      : "Resend OTP"}
                  </button>
                )}
              </div>

              {/* Info */}
              <p className="text-[10px] text-center text-muted-foreground font-mono">
                Check your spam folder if you don't see the email.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4">
          <p className="text-[10px] text-center text-muted-foreground font-mono">
            Logged in as <span className="text-foreground">{user.email}</span> ·{" "}
            <button
              onClick={() => base44.auth.logout()}
              className="text-destructive hover:underline"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}