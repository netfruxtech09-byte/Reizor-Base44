import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Editable artist profile fields — kept in sync with submitArtistProfileEdit.
const EDITABLE_FIELDS = [
  "display_name", "bio", "genre", "profile_image",
  "city", "state", "country", "location",
  "contact_email", "website", "instagram", "twitter",
  "soundcloud", "spotify", "tiktok",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { edit_id, action, rejection_reason } = await req.json();
    if (!edit_id || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    let edit;
    try {
      const edits = await base44.asServiceRole.entities.ArtistProfileEdit.filter({ id: edit_id }, null, 1);
      edit = edits?.[0];
    } catch (_e) {
      return Response.json({ error: 'Edit request not found' }, { status: 404 });
    }
    if (!edit) return Response.json({ error: 'Edit request not found' }, { status: 404 });

    const now = new Date().toISOString();

    if (action === 'approve') {
      let artist;
      try {
        const artists = await base44.asServiceRole.entities.Artist.filter({ id: edit.artist_id }, null, 1);
        artist = artists?.[0];
      } catch (_e) {
        return Response.json({ error: 'Artist not found' }, { status: 404 });
      }
      if (!artist) return Response.json({ error: 'Artist not found' }, { status: 404 });

      // Apply only the editable fields present in the pending payload to the live record.
      const update = {};
      const pd = edit.pending_data || {};
      for (const f of EDITABLE_FIELDS) {
        if (pd[f] !== undefined) update[f] = pd[f];
      }
      await base44.asServiceRole.entities.Artist.update(edit.artist_id, update);

      await base44.asServiceRole.entities.ArtistProfileEdit.update(edit_id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: now,
      });

      await base44.asServiceRole.entities.Notification.create({
        user_email: edit.artist_email,
        title: 'Profile Update Approved',
        message: 'Your profile changes have been approved and are now live on your public profile.',
        type: 'general',
        link: `/artists/${edit.artist_id}`,
      }).catch(() => {});

      return Response.json({ success: true, action: 'approve' });
    }

    // reject — public profile stays untouched
    await base44.asServiceRole.entities.ArtistProfileEdit.update(edit_id, {
      status: 'rejected',
      rejection_reason: rejection_reason || '',
      reviewed_by: user.email,
      reviewed_at: now,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_email: edit.artist_email,
      title: 'Profile Update Rejected',
      message: rejection_reason
        ? `Your profile update request was rejected: ${rejection_reason}. You can edit and resubmit.`
        : 'Your profile update request was rejected. You can edit and resubmit.',
      type: 'general',
      link: '/artist/signup?mode=edit',
    }).catch(() => {});

    return Response.json({ success: true, action: 'reject' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});