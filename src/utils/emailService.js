/**
 * Frontend email helper — routes all outgoing emails through the Gmail-based emailService backend function.
 *
 * Usage:
 *   import { sendEmail } from '@/utils/emailService';
 *   await sendEmail({ to, subject, body, vars, _source });
 *
 * Parameters:
 *   to       — string or string[]  (required)
 *   subject  — string              (required)
 *   body     — HTML string         (required)
 *   cc       — string or string[]  (optional)
 *   bcc      — string or string[]  (optional)
 *   replyTo  — string              (optional)
 *   vars     — { [key]: value }    optional dynamic variable map, replaces {{KEY}} in subject/body
 *   _source  — string              optional label for server logs (e.g. "EventDetail/checkout")
 */

import { base44 } from '@/api/base44Client';

export async function sendEmail({ to, subject, body, cc, bcc, replyTo, vars, _source = 'frontend' }) {
  const res = await base44.functions.invoke('emailService', {
    to,
    subject,
    body,
    cc,
    bcc,
    replyTo,
    vars,
    _source,
  });
  return res.data;
}