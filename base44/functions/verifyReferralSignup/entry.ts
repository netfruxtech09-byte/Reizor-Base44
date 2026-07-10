import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Disposable email domains
const DISPOSABLE_EMAILS = [
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'mailinator.com',
  'temp-mail.org', 'maildrop.cc', 'yopmail.com', 'temp-mail.io', 'trashmail.com'
];

const SUSPICIOUS_PATTERNS = [
  /\d{5,}@/,
  /(test|fake|bot|dummy|xxx)\d*@/i,
  /a+b+c+@/i,
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { refEmail, refName, referralCode } = await req.json();

    if (!refEmail || !refName || !referralCode) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Basic validation
    const issues = [];

    // 1. Check email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refEmail)) {
      issues.push('Invalid email format');
    }

    // 2. Check for disposable email
    const domain = refEmail.split('@')[1]?.toLowerCase();
    if (DISPOSABLE_EMAILS.includes(domain)) {
      issues.push('Temporary email service detected');
    }

    // 3. Check for suspicious patterns
    if (SUSPICIOUS_PATTERNS.some(p => p.test(refEmail))) {
      issues.push('Suspicious email pattern');
    }

    // 4. Check name validity
    if (!refName || refName.trim().length < 2) {
      issues.push('Invalid name');
    }

    if (/^\d+$/.test(refName.replace(/\s/g, ''))) {
      issues.push('Name contains only numbers');
    }

    if (/^(.)\1{5,}$/.test(refName.replace(/\s/g, ''))) {
      issues.push('Name has repeated characters');
    }

    // 5. Check if account already exists
    const existingUser = await base44.entities.User.list(null, 1).catch(() => []);
    const userExists = existingUser.some(u => u.email === refEmail);
    if (userExists) {
      issues.push('Account already registered');
    }

    // 6. Check referral code validity
    const referrer = await base44.entities.Referral.filter({ referral_code: referralCode }, null, 1);
    if (referrer.length === 0) {
      issues.push('Invalid referral code');
    }

    // Determine risk level
    let riskLevel = 'low';
    if (issues.length > 2) riskLevel = 'high';
    else if (issues.length > 0) riskLevel = 'medium';

    return Response.json({
      valid: issues.length === 0,
      issues,
      riskLevel,
      timestamp: new Date().toISOString(),
      referralCode,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});