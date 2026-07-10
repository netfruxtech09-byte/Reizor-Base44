// Referral security validation functions

const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'mailinator.com',
  'temp-mail.org', 'maildrop.cc', 'yopmail.com', 'temp-mail.io', 'trashmail.com'
];

const SUSPICIOUS_EMAIL_PATTERNS = [
  /\d{5,}@/,  // Many consecutive numbers
  /(test|fake|bot|dummy|xxx)\d*@/i,  // Common fake account keywords
  /a+b+c+@/i,  // Sequential letters
];

/**
 * Check if email is from a disposable/temporary email service
 */
export function isDisposableEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}

/**
 * Check if email matches suspicious patterns
 */
export function hasSuspiciousPattern(email) {
  if (!email) return false;
  return SUSPICIOUS_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Check if full name looks legitimate
 */
export function isValidName(name) {
  if (!name || name.trim().length < 2) return false;
  // Check for names that are too short or only numbers
  if (/^\d+$/.test(name)) return false;
  // Check for names that are just repeated characters
  if (/^(.)\1{5,}$/.test(name.replace(/\s/g, ''))) return false;
  return true;
}

/**
 * Perform comprehensive fraud check on signup
 * Returns { isValid: boolean, issues: string[] }
 */
export function validateReferralSignup(userEmail, userFullName) {
  const issues = [];

  if (!isValidEmail(userEmail)) {
    issues.push('Invalid email format');
  }

  if (!isValidName(userFullName)) {
    issues.push('Invalid name');
  }

  if (isDisposableEmail(userEmail)) {
    issues.push('Temporary email not allowed');
  }

  if (hasSuspiciousPattern(userEmail)) {
    issues.push('Email matches suspicious pattern');
  }

  return {
    isValid: issues.length === 0,
    issues,
    riskLevel: issues.length > 2 ? 'high' : issues.length > 0 ? 'medium' : 'low',
  };
}