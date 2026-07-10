import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { validateReferralSignup } from '@/lib/referralSecurityChecks';

export default function ReferralSignupSecurityCheck({ userEmail, userFullName, referralCode, onVerified, onError }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const performSecurityCheck = async () => {
    setChecking(true);
    try {
      // Client-side checks first
      const clientCheck = validateReferralSignup(userEmail, userFullName);
      
      if (!clientCheck.isValid) {
        setResult({
          valid: false,
          issues: clientCheck.issues,
          riskLevel: clientCheck.riskLevel,
        });
        onError?.(`Signup blocked: ${clientCheck.issues.join(', ')}`);
        setChecking(false);
        return;
      }

      // Server-side verification
      const serverCheck = await base44.functions.invoke('verifyReferralSignup', {
        refEmail: userEmail,
        refName: userFullName,
        referralCode,
      });

      setResult(serverCheck);

      if (serverCheck.valid) {
        onVerified?.(serverCheck);
      } else {
        onError?.(`Verification failed: ${serverCheck.issues.join(', ')}`);
      }
    } catch (err) {
      setResult({
        valid: false,
        issues: ['Verification service error'],
        riskLevel: 'high',
      });
      onError?.(err.message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (userEmail && userFullName && referralCode) {
      performSecurityCheck();
    }
  }, [userEmail, userFullName, referralCode]);

  if (!result) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verifying signup...
      </div>
    );
  }

  if (result.valid) {
    return (
      <Alert className="border-green-400/30 bg-green-400/5">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <AlertDescription className="text-green-400/90">
          ✓ Signup verification passed
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-destructive/30 bg-destructive/5">
      <AlertCircle className="w-4 h-4 text-destructive" />
      <AlertDescription className="text-destructive/90">
        Signup blocked: {result.issues.join(', ')}
      </AlertDescription>
    </Alert>
  );
}