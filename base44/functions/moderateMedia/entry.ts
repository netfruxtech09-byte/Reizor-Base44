import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * moderateMedia — handles media approval, rejection, blocking and deletion
 * Also called on new uploads to auto-approve admin uploads and set pending for others.
 *
 * Actions:
 *   - approve   : set approval_status = "approved", notify user
 *   - reject    : set approval_status = "rejected", notify user
 *   - block     : set approval_status = "blocked",  notify user
 *   - delete    : delete the media item
 *   - set_pending : set approval_status = "pending_review"
 *   - auto_approve_admin : called on upload — sets approved if user is admin, pending otherwise
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, entity_type, entity_id, note } = body;

    // Only admins can moderate
    if (!['approve', 'reject', 'block', 'delete', 'auto_approve_admin', 'set_pending'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (action !== 'auto_approve_admin' && action !== 'set_pending' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Helper: notify all admins with duplicate protection
    const notifyAdmins = async ({ title, message, link }) => {
      const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
      const admins = allUsers.filter(u => u.role === 'admin');
      await Promise.all(admins.map(async (admin) => {
        const existing = await base44.asServiceRole.entities.Notification.filter({
          user_email: admin.email,
          link,
        }, null, 50).catch(() => []);
        const isDuplicate = existing.some(n => n.title === title && n.message === message);
        if (isDuplicate) return;
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          title,
          message,
          type: 'general',
          link,
        }).catch(() => {});
      }));
    };

    // Helper: get entity SDK
    const getEntity = (type) => {
      if (type === 'MediaItem') return base44.asServiceRole.entities.MediaItem;
      if (type === 'CommunityPost') return base44.asServiceRole.entities.CommunityPost;
      if (type === 'ArtistAlbum') return base44.asServiceRole.entities.ArtistAlbum;
      if (type === 'OrganizerMediaPost') return base44.asServiceRole.entities.OrganizerMediaPost;
      if (type === 'ArtistPost') return base44.asServiceRole.entities.ArtistPost;
      return null;
    };

    const entity = getEntity(entity_type);
    if (!entity) return Response.json({ error: 'Unknown entity type' }, { status: 400 });

    // Fetch the current record to get uploader info
    let records = [];
    if (entity_type === 'MediaItem') {
      records = await base44.asServiceRole.entities.MediaItem.filter({ id: entity_id }, null, 1).catch(() => []);
    } else if (entity_type === 'CommunityPost') {
      records = await base44.asServiceRole.entities.CommunityPost.filter({ id: entity_id }, null, 1).catch(() => []);
    } else if (entity_type === 'ArtistAlbum') {
      records = await base44.asServiceRole.entities.ArtistAlbum.filter({ id: entity_id }, null, 1).catch(() => []);
    } else if (entity_type === 'OrganizerMediaPost') {
      records = await base44.asServiceRole.entities.OrganizerMediaPost.filter({ id: entity_id }, null, 1).catch(() => []);
    } else if (entity_type === 'ArtistPost') {
      records = await base44.asServiceRole.entities.ArtistPost.filter({ id: entity_id }, null, 1).catch(() => []);
    }
    const record = records[0];

    if (action === 'auto_approve_admin') {
      // Called during upload — auto-approve if uploader is admin, else set pending
      const isAdmin = user.role === 'admin';
      const newStatus = isAdmin ? 'approved' : 'pending_review';

      if (entity_type === 'MediaItem') {
        await base44.asServiceRole.entities.MediaItem.update(entity_id, {
          approval_status: newStatus,
          uploaded_by_email: user.email,
          uploaded_by_name: user.full_name || user.email,
          uploaded_by_role: user.role || 'user',
        });
      } else if (entity_type === 'CommunityPost') {
        await base44.asServiceRole.entities.CommunityPost.update(entity_id, {
          media_approval_status: newStatus,
        });
      } else if (entity_type === 'ArtistAlbum') {
        await base44.asServiceRole.entities.ArtistAlbum.update(entity_id, {
          approval_status: newStatus,
        });
      } else if (entity_type === 'OrganizerMediaPost') {
        await base44.asServiceRole.entities.OrganizerMediaPost.update(entity_id, {
          approval_status: newStatus,
          uploaded_by_email: user.email,
          uploaded_by_role: user.role || 'organizer',
        });
      } else if (entity_type === 'ArtistPost') {
        await base44.asServiceRole.entities.ArtistPost.update(entity_id, {
          approval_status: newStatus,
        });
      }

      // Notify non-admin uploader that their media is pending
      if (!isAdmin) {
        const uploaderEmail = record?.uploaded_by_email || record?.author_email || record?.artist_email || record?.created_by || user.email;
        await base44.asServiceRole.entities.Notification.create({
          user_email: uploaderEmail,
          title: '📸 Media submitted for review',
          message: 'Your media has been submitted for admin approval. It will appear on the website after approval.',
          type: 'general',
        }).catch(() => {});

        // Notify all admins about new pending media
        const mediaLabel = record?.title || record?.caption || record?.venue_name || entity_type;
        const uploaderName = record?.uploaded_by_name || record?.author_name || record?.artist_name || user.full_name || uploaderEmail;
        await notifyAdmins({
          title: '🖼 New media pending review',
          message: `${uploaderName} (${user.role}) uploaded "${mediaLabel}" — awaiting moderation.`,
          link: '/admin/moderation',
        });
      }

      return Response.json({ success: true, approval_status: newStatus });
    }

    if (action === 'set_pending') {
      const field = entity_type === 'CommunityPost' ? 'media_approval_status' : 'approval_status';
      await entity.update(entity_id, { [field]: 'pending_review' });
      // Notify admins that media has been manually flagged for review
      if (record) {
        const uploaderEmail = record.uploaded_by_email || record.author_email || record.artist_email || 'unknown';
        const uploaderRole = record.uploaded_by_role || record.author_role || 'user';
        const mediaTitle = record.title || record.caption || entity_type;
        await notifyAdmins({
          title: 'Media Review Required',
          message: `A media item (${mediaTitle}) uploaded by ${uploaderEmail} [${uploaderRole}] has been flagged as prohibited content and needs review.`,
          link: `/admin/moderation`,
        });
      }
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      await entity.delete(entity_id);
      return Response.json({ success: true });
    }

    // approve / reject / block
    const statusMap = { approve: 'approved', reject: 'rejected', block: 'blocked' };
    const newStatus = statusMap[action];

    if (entity_type === 'CommunityPost') {
      await base44.asServiceRole.entities.CommunityPost.update(entity_id, {
        media_approval_status: newStatus,
      });
    } else {
      await entity.update(entity_id, {
        approval_status: newStatus,
        moderation_note: note || '',
        moderated_at: now,
        moderated_by: user.email,
      });
    }

    // Notify the uploader
    const uploaderEmail = record?.uploaded_by_email || record?.author_email || record?.artist_email;
    if (uploaderEmail) {
      let title = '';
      let message = '';
      if (action === 'approve') {
        title = '✅ Your media has been approved!';
        message = 'Your uploaded media has been approved and is now visible on the platform.';
      } else if (action === 'reject') {
        title = '❌ Media not approved';
        message = 'Your uploaded media was not approved because it may violate platform guidelines.' + (note ? ` Reason: ${note}` : '');
      } else if (action === 'block') {
        title = '🚫 Media blocked';
        message = 'Your uploaded media has been blocked due to a violation of platform guidelines.' + (note ? ` Reason: ${note}` : '');
      }

      await base44.asServiceRole.entities.Notification.create({
        user_email: uploaderEmail,
        title,
        message,
        type: 'general',
      }).catch(() => {});

      // Also send email
      if (action === 'approve') {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: uploaderEmail,
          subject: '✅ Your media has been approved',
          body: `<p>Hi,</p><p>Your uploaded media has been approved and is now visible on the platform.</p>`,
        }).catch(() => {});
      } else if (action === 'reject') {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: uploaderEmail,
          subject: '❌ Your media was not approved',
          body: `<p>Hi,</p><p>Your uploaded media was not approved because it may violate platform guidelines.${note ? ` Reason: ${note}` : ''}</p>`,
        }).catch(() => {});
      }
    }

    return Response.json({ success: true, approval_status: newStatus });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});