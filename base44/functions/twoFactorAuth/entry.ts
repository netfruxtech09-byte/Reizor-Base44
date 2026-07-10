import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5; // brute-force limit per OTP

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'send') {
      // Check if a recent OTP was already sent (within 5 minutes) and not yet used
      const existing = await base44.asServiceRole.entities.TwoFactorOTP.filter(
        { user_email: user.email }, '-created_date', 1
      ).catch(() => []);

      if (existing.length > 0) {
        const last = existing[0];
        const sentAt = new Date(last.created_date).getTime();
        const elapsed = Date.now() - sentAt;

        if (elapsed < OTP_EXPIRY_MS && !last.used) {
          const waitSecs = Math.ceil((OTP_EXPIRY_MS - elapsed) / 1000);
          const waitMins = Math.ceil(waitSecs / 60);
          return Response.json({
            error: 'too_soon',
            message: `Please wait 5 minutes before requesting a new OTP.`,
            wait_seconds: waitSecs,
          }, { status: 429 });
        }

        // Invalidate all previous unused OTPs for this user before issuing a new one
        const allOld = await base44.asServiceRole.entities.TwoFactorOTP.filter(
          { user_email: user.email, used: false }, null, 50
        ).catch(() => []);
        await Promise.all(allOld.map(r =>
          base44.asServiceRole.entities.TwoFactorOTP.update(r.id, { used: true }).catch(() => {})
        ));
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

      // Save to DB with attempt counter
      await base44.asServiceRole.entities.TwoFactorOTP.create({
        user_email: user.email,
        otp_hash: otp,
        expires_at: expiresAt,
        used: false,
        attempts: 0,
      });

      // Send email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: 'Your verification code',
        body: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Security Verification</h2>
            <p>Your one-time verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ff1b8d; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666;">This code expires in <strong>5 minutes</strong>.</p>
            <p style="color: #666;">If you did not attempt to log in, please secure your account immediately.</p>
          </div>
        `,
      });

      return Response.json({ success: true, expires_at: expiresAt });

    } else if (action === 'verify') {
      const { otp } = body;
      if (!otp) return Response.json({ error: 'OTP is required' }, { status: 400 });

      // Get the latest unused OTP for this user
      const records = await base44.asServiceRole.entities.TwoFactorOTP.filter(
        { user_email: user.email, used: false }, '-created_date', 1
      ).catch(() => []);

      if (records.length === 0) {
        return Response.json({ error: 'no_otp', message: 'No active OTP found. Please request a new one.' }, { status: 400 });
      }

      const record = records[0];

      // Check expiry
      if (new Date(record.expires_at) < new Date()) {
        await base44.asServiceRole.entities.TwoFactorOTP.update(record.id, { used: true }).catch(() => {});
        return Response.json({ error: 'expired', message: 'OTP has expired. Please request a new one.' }, { status: 400 });
      }

      // Brute-force protection: max attempts per OTP
      const attempts = (record.attempts || 0) + 1;
      if (attempts > MAX_ATTEMPTS) {
        await base44.asServiceRole.entities.TwoFactorOTP.update(record.id, { used: true }).catch(() => {});
        return Response.json({ error: 'too_many_attempts', message: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 });
      }

      // Check OTP match
      if (record.otp_hash !== String(otp).trim()) {
        await base44.asServiceRole.entities.TwoFactorOTP.update(record.id, { attempts }).catch(() => {});
        const remaining = MAX_ATTEMPTS - attempts;
        return Response.json({
          error: 'invalid',
          message: remaining > 0
            ? `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Invalid OTP. Please request a new one.',
        }, { status: 400 });
      }

      // Mark as used
      await base44.asServiceRole.entities.TwoFactorOTP.update(record.id, { used: true });

      return Response.json({ success: true });

    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});