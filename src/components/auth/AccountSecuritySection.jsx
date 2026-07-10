import { useState } from 'react';
import { Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AccountSecuritySection({ user }) {
  const [mode, setMode] = useState(null); // null | 'email' | 'password'
  const [step, setStep] = useState(1); // 1: request, 2: verify
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Request verification code
  const requestCode = async () => {
    setError('');
    setSuccess('');
    
    if (mode === 'email' && !newEmail) {
      setError('Please enter a new email address');
      return;
    }
    if (mode === 'password' && (!newPassword || !newPasswordConfirm)) {
      setError('Please enter and confirm your new password');
      return;
    }
    if (mode === 'password' && newPassword !== newPasswordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (mode === 'password' && newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('sendVerificationCode', {
        type: mode,
        email: user.email,
        phone: user.phone || null,
      });
      
      if (!res.data.success) {
        setError(res.data.error || 'Failed to send code');
        setLoading(false);
        return;
      }
      
      setStep(2);
      setCode('');
      setSuccess('Verification code sent! Check your email or phone.');
      setResendCooldown(60);
      
      // Cooldown timer
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verify code and update
  const verifyAndUpdate = async () => {
    setError('');
    setSuccess('');

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('verifyAndUpdateAccount', {
        type: mode,
        email: user.email,
        code,
        newEmail: mode === 'email' ? newEmail : null,
        newPassword: mode === 'password' ? newPassword : null,
      });

      if (!res.data.success) {
        setError(res.data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      setSuccess(`${mode === 'email' ? 'Email' : 'Password'} updated successfully!`);
      
      setTimeout(() => {
        resetForm();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode(null);
    setStep(1);
    setCode('');
    setNewEmail('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setError('');
    setSuccess('');
    setResendCooldown(0);
  };

  if (!mode) {
    return (
      <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">🔐 Account Security</p>
        <Button
          onClick={() => setMode('email')}
          className="w-full gap-2 justify-start text-left h-auto py-3 px-4 bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground"
        >
          <Mail className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-sm">Change Email</p>
            <p className="text-xs text-muted-foreground font-mono">Update your email address securely</p>
          </div>
        </Button>

        <Button
          onClick={() => setMode('password')}
          className="w-full gap-2 justify-start text-left h-auto py-3 px-4 bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground"
        >
          <Lock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-sm">Change Password</p>
            <p className="text-xs text-muted-foreground font-mono">Update your password securely</p>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">
          {mode === 'email' ? 'Change Email' : 'Change Password'}
        </h3>
        <button
          onClick={resetForm}
          className="text-xs text-muted-foreground hover:text-foreground font-mono"
        >
          ✕ Cancel
        </button>
      </div>

      {error && (
        <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-500">{success}</p>
        </div>
      )}

      {step === 1 ? (
        <div className="space-y-4">
          {mode === 'email' && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">New Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
                className="mt-1 bg-secondary border-border/50"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'password' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-1 bg-secondary border-border/50"
                  disabled={loading}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Confirm Password</Label>
                <Input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1 bg-secondary border-border/50"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground font-mono">
            A verification code will be sent to your email or phone on file.
          </p>

          <Button
            onClick={requestCode}
            disabled={loading}
            className="w-full glow-lime font-display font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...
              </>
            ) : (
              'Send Verification Code'
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">
              Enter 6-Digit Code
            </Label>
            <Input
              type="text"
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="mt-1 bg-secondary border-border/50 text-center text-lg font-mono tracking-widest"
              disabled={loading}
            />
          </div>

          <Button
            onClick={verifyAndUpdate}
            disabled={loading || !code || resendCooldown > 0}
            className="w-full glow-lime font-display font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying...
              </>
            ) : (
              'Verify & Update'
            )}
          </Button>

          <Button
            onClick={requestCode}
            variant="outline"
            disabled={loading || resendCooldown > 0}
            className="w-full border-border/50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </Button>
        </div>
      )}
    </div>
  );
}