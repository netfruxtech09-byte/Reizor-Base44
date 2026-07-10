import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, email, phone } = body;

    if (!['email', 'password'].includes(type)) {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    
    // Store code with expiration (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    // Save verification record
    await base44.asServiceRole.entities.TwoFactorOTP.create({
      user_email: email,
      otp_code: code,
      expires_at: expiresAt,
      verified: false,
      type: `account_${type}`, // account_email or account_password
    });

    // Send email with code
    const subject = type === 'email' 
      ? 'Verify Your Email Change on Reizor' 
      : 'Verify Your Password Change on Reizor';
    
    const message = type === 'email'
      ? `Your verification code is: <strong>${code}</strong><br>This code expires in 10 minutes.<br>Do not share this code with anyone.`
      : `Your verification code is: <strong>${code}</strong><br>This code expires in 10 minutes.<br>Do not share this code with anyone.`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
          <h2>Security Verification</h2>
          <p>You requested to ${type === 'email' ? 'change your email' : 'change your password'} on Reizor.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 0;">${code}</p>
          </div>
          <p>${message}</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});