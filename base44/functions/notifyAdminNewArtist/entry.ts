import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const artist = payload.data;

    if (!artist || artist.approval_status !== 'pending') {
      return Response.json({ skipped: true });
    }

    // Get all admin users
    const allUsers = await base44.asServiceRole.entities.User.list(null, 500);
    const admins = allUsers.filter(u => u.role === 'admin');

    // Notify each admin — with duplicate protection per artist
    await Promise.all(admins.map(async admin => {
      // Duplicate check: skip if admin already has a pending-approval notification for this artist
      const existing = await base44.asServiceRole.entities.Notification.filter({
        user_email: admin.email,
        link: '/admin/artists',
      }, null, 50).catch(() => []);
      const alreadyNotified = existing.some(n =>
        n.title === 'Artist Approval Required' &&
        n.message?.includes(artist.user_email)
      );
      if (alreadyNotified) return;

      // In-platform notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: 'Artist Approval Required',
        message: `${artist.display_name} (${artist.user_email}) has submitted a profile for approval. Genre: ${artist.genre || '—'}.`,
        type: 'general',
        link: '/admin/artists',
      });

      // Email notification
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `🎤 New Artist Application: ${artist.display_name}`,
        body: `
          <div style="font-family:Arial,sans-serif;background:#0a0d1a;padding:32px;color:#c8d0e8;">
            <h2 style="color:#ff1b8d;margin:0 0 16px;">New Artist Application</h2>
            <p>A new artist has applied to join Reizor and is awaiting your approval.</p>
            <table style="width:100%;background:#0f1529;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #1e2a45;">
              <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Name</td><td style="color:#fff;font-weight:bold;">${artist.display_name}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Email</td><td style="color:#c8d0e8;">${artist.user_email}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Genre</td><td style="color:#c8d0e8;">${artist.genre || '—'}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Location</td><td style="color:#c8d0e8;">${artist.location || '—'}</td></tr>
            </table>
            <a href="${Deno.env.get('BASE44_APP_URL') || 'https://onyx-ticket-pulse.base44.app'}/admin/artists" style="display:inline-block;background:#ff1b8d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Review Application →</a>
          </div>
        `,
      }).catch(() => {});
    }));

    return Response.json({ success: true, notified: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});